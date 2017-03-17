// ==UserScript==
// @name         IndieGala: Auto-enter Giveaways
// @version      2.0.0
// @description  Automatically enters IndieGala Giveaways
// @author       Hafas (https://github.com/Hafas/)
// @match        https://www.indiegala.com/giveaways*
// @grant        none
// ==/UserScript==

(function () {
  /**
  * change values to customize the script's behaviour
  */
  var options = {
    joinOwnedGames: false,
    //set to 0 to ignore the number of participants
    maxParticipants: 0,
    //Array of names of games
    gameBlacklist: [],
    onlyEnterGuaranteed: false,
    //Array of names of users
    userBlacklist: [],
    //Some giveaways don't link to the game directly but to a sub containing that game. IndieGala is displaying these games as "not owned" even if you own that game
    skipSubGiveaways: false,
    interceptAlert: false,
    //how many minutes to wait at the end of the line until restarting from the beginning
    waitOnEnd: 60,
    //Display logs
    debug: false
  };

  var waitOnEnd = options.waitOnEnd * 60 * 1000;

  var Status = {
    CRASHED: "CRASHED",
    INITIALIZING: "INITIALIZING",
    RUNNING: "RUNNING",
    STOPPED: "STOPPED",
    WAITING_FOR_RECHARGE: "WAITING_FOR_RECHARGE"
  };

  /**
  * current state
  */
  var state = {
    status: Status.INITIALIZING,

    currentPage: 1,
    totalPages: undefined,

    level: undefined,
    coins: undefined,
    nextRecharge: undefined,

    enteredGiveaways: 0
  };

  var ID_PREFIX = "ig-auto-enter-";
  function generateId (name) {
    return ID_PREFIX + name;
  }
  var STATUS_ID = generateId("status");
  var PAGE_ID = generateId("page");
  var LEVEL_ID = generateId("level");
  var COINS_ID = generateId("coins");
  var RECHARGE_ID = generateId("recharge");
  var ENTERED_ID = generateId("entered");

  function start () {
    if (!isGiveawayPage()) {
      //I'm not on a giveaway list page. Script stops here.
      log("Current page is not a giveaway list page. Stopping script.");
      return;
    }
    createInfoBox();
    callGetUserLevelAndCoinsApi();
    callProfileApi();
    run();
  }

  function run () {
    setStatus(Status.RUNNING);
    setCurrentPage(1);
    processCurrentPage().fail(function (err) {
      error("Something went wrong:", err);
      setStatus(Status.CRASHED);
    });
  }

  var TOTAL_PAGES_PATTERN = /^\/giveaways\/([0-9]+)/;

  function processCurrentPage () {
    if (state.coins === 0) {
      info("No coins available. Waiting for recharge.");
      setStatus(Status.WAITING_FOR_RECHARGE);
      return;
    }
    var currentPage = state.currentPage;
    log("processing page", currentPage);
    return request({
      url: "/giveaways/" + currentPage + "/expiry/asc/level/all",
      dataType: "html"
    }).then(function (payload) {
      var $html = $(payload);
      var match = TOTAL_PAGES_PATTERN.exec($(".prev-next", $html).last().attr("href"));
      if (match) {
        setTotalPages(Number(match[1]));
      }
      var giveaways = getGiveaways($html);
      if (giveaways.length === 0) {
        //it occasionally happens, that the giveaway page is empty even though there is still more
        //so we check if the last known total page number is significantly higher than the current page number
        //if that's the case we assume, that IndieGala is bugging around and we retry the request
        if (currentPage < (state.totalPages - 5)) {
          return processCurrentPage();
        }
        //end of the line
        return handleEndOfTheLine();
      }
      return setOwned(giveaways).then(enterGiveaways).then(function () {
        if (currentPage === state.totalPages) {
          //end of the line
          return handleEndOfTheLine();
        }
        setCurrentPage(currentPage + 1);
        return processCurrentPage();
      });
    });
  }

  function handleEndOfTheLine () {
    setStatus(Status.IDLING);
    return delay(function () {
      if (state.status === Status.IDLING) {
        return run();
      }
    }, waitOnEnd);
  }

  function callGetUserLevelAndCoinsApi () {
    request({
      url: "/giveaways/get_user_level_and_coins"
    }).then(function (payload) {
      log("callGetUserLevelAndCoinsApi", "payload", payload);
      var level = Number(payload.current_level);
      if (!isNaN(level)) {
        setLevel(level);
      } else {
        error("'/giveaways/get_user_level_and_coins' returned an unexpected level value.");
      }
    });
  }

  function callProfileApi () {
    request({
      url: "/profile",
      dataType: "html"
    }).then(function (payload) {
      var $html = $(payload);
      var minutesAsText = $("#next-recharge-mins", $html).text();
      var minutes = Number(minutesAsText);
      if (minutesAsText && minutes >= 0) {
        var time = new Date(new Date().getTime() + (minutes + 1) * 60 * 1000);
        setRecharge(time);
      } else {
        error("'/profile' returned an unexpected recharge value.");
      }
      //don't use coins value from profile when already set from entered giveaways, because this value is by then outdated
      if (state.coins === undefined) {
        var coins = Number($(".galasilver-profile", $html).text());
        if (!isNaN(coins)) {
          setCoins(coins);
        } else {
          error("'/profile' returned an unexpected coins value.");
        }
      }
    });
  }


  function renderSpacer () {
    return "<div class='spacer-v-10'></div>";
  }

  function renderInfoRow (id, content) {
    return "<div id='" + id + "' class='info-row'>" + content + "</div>";
  }

  function rerender (id, content) {
    $("#" + id).html(content);
  }

  //status

  function setStatus (status) {
    state.status = status;
    rerender(STATUS_ID, renderStatus());
  }

  function getStatusText () {
    switch (state.status) {
      case Status.CRASHED: {
        return "Crashed";
      }
      case Status.IDLING: {
        return "Idling";
      }
      case Status.INITIALIZING: {
        return "Initializing";
      }
      case Status.RUNNING: {
        return "Running";
      }
      case Status.STOPPED: {
        return "Stopped";
      }
      case Status.WAITING_FOR_RECHARGE: {
        return "Waiting for recharge";
      }
      default: {
        return "Unknown";
      }
    }
  }

  function renderStatus () {
    return "Status: " + getStatusText();
  }

  //currentPage

  function setCurrentPage (currentPage) {
    state.currentPage = currentPage;
    rerender(PAGE_ID, renderCurrentPage());
  }

  function setTotalPages (totalPages) {
    state.totalPages = totalPages;
    rerender(PAGE_ID, renderCurrentPage());
  }

  function renderCurrentPage () {
    var currentPage = state.currentPage;
    var totalPages = state.totalPages;
    var text = "Current page: " + currentPage;
    if (totalPages) {
      return text + " / " + totalPages;
    }
    return text;
  }

  //level

  function setLevel (level) {
    state.level = level;
    rerender(LEVEL_ID, renderLevel());
  }

  function getLevelText () {
    var level = state.level;
    if (level === undefined) {
      return "Unknown";
    }
    return level;
  }

  function renderLevel () {
    return "Level: " + getLevelText();
  }

  //coins

  function setCoins (coins) {
    state.coins = coins;
    rerender(COINS_ID, renderCoins());
  }

  function getCoinsText () {
    var coins = state.coins;
    if (coins === undefined) {
      return "Unknown";
    }
    return coins;
  }

  function renderCoins () {
    return "Available coins: " + getCoinsText();
  }

  //recharge

  function setRecharge (recharge) {
    state.recharge = recharge;
    if (recharge) {
      var now = new Date();
      var diff = recharge.getTime() - now.getTime();
      setTimeout(handleRecharge, diff);
    }
    rerenderRecharge();
  }

  function handleRecharge () {
    setCoins(state.coins + 10);
    setRecharge(new Date(state.recharge.getTime() + 60 * 60 * 1000));
    if (state.status === Status.WAITING_FOR_RECHARGE) {
      run();
    }
  }

  function getRechargeText () {
    var recharge = state.recharge;
    if (recharge === undefined) {
      return "Unknown";
    }
    var now = new Date();
    var diff = recharge.getTime() - now.getTime();
    if (diff <= 0) {
      return "00:00";
    }
    var seconds = parseInt((diff / 1000) % 60);
    var minutes = parseInt((diff / 1000 / 60) % 60);
    var text = "";
    if (minutes < 10) {
      text += "0";
    }
    text += minutes + ":";
    if (seconds < 10) {
      text += "0";
    }
    text += seconds;
    return text;
  }

  function rerenderRecharge ()  {
    rerender(RECHARGE_ID, renderRecharge());
  }

  function renderRecharge () {
    if (state.recharge) {
      //as long there is a value rerender every second
      setTimeout(rerenderRecharge, 1000);
    }
    return "Time until recharge: " + getRechargeText();
  }

  //entered

  function incrementEnteredGiveaways () {
    state.enteredGiveaways++;
    rerender(ENTERED_ID, renderEnteredGiveaways());
  }

  function renderEnteredGiveaways () {
    return "Entered giveaways: " + state.enteredGiveaways;
  }

  //info box

  function createInfoBox () {
    var spotlights = $("#carousel-cover").parent().parent();
    spotlights.after("" +
      "<div class='spacer-v-15'/>" +
      "<div class='cover-cont'>" +
        "<div class='cover-text palette-background-1'>" +
          "IndieGala: Auto-enter Giveaways" +
        "</div>" +
        "<div class='palette-border-1' style='width: 100%; border: 4px solid; border-top: none; border-color: #CC001D;'>" +
          "<div class='height-cont palette-background-6' style='background-color: #DAD6CA;'>" +
            "<div style='padding: 3px;'>" +
              "<div style='padding: 5px; border: 2px solid #999;'>" +
                renderInfoRow(STATUS_ID, renderStatus()) +
                renderSpacer() +
                renderInfoRow(PAGE_ID, renderCurrentPage()) +
                renderSpacer() +
                renderInfoRow(LEVEL_ID, renderLevel()) +
                renderSpacer() +
                renderInfoRow(COINS_ID, renderCoins()) +
                renderSpacer() +
                renderInfoRow(RECHARGE_ID, renderRecharge()) +
                renderSpacer() +
                renderInfoRow(ENTERED_ID, renderEnteredGiveaways()) +
              "</div>" +
            "</div>" +
          "</div>" +
        "</div>" +
      "</div>" +
    "");
    var infoBox = spotlights.next();
    return infoBox;
  }

  //utils

  var DEFAULT_REQUEST_PROPS = {
    method: "GET",
    dataType: "json"
  };

  function request (_props) {
    var props = $.extend({}, DEFAULT_REQUEST_PROPS, _props);
    return $.when().then(function () {
      return $.ajax(props).then(null, function (error) {
        if (error.status === 200) {
          return $.Deferred().reject(error);
        }
        log("Request to", props.method, props.url, "failed or timed out. Retrying ...", error);
        return request(props);
      });
    });
  }

  var GIVEAWAY_PAGE_PATTERN = /^\/giveaways(\/[0-9]+\/|\/?)$/;

  function isGiveawayPage () {
    var currentPath = window.location.pathname;
    var match = GIVEAWAY_PAGE_PATTERN.exec(currentPath);
    if (match === null) {
      return false;
    }
    return true;
  }


  /**
   * sets the owned-property of each giveaway, by sending a request to IndieGala
   */
  function setOwned (giveaways) {
    var gameIds = giveaways.map(function (giveaway) {
      if (giveaway.idType === IdType.APP) {
        return giveaway.steamId;
      }
      return giveaway.gameId;
    });
    return request({
      url: "/giveaways/match_games_in_steam_library",
      method: "POST",
      data: JSON.stringify({"games_id": gameIds})
    }).then(function (ownedIds) {
      for (var i = 0; i < giveaways.length; ++i) {
        var giveaway = giveaways[i];
        for (var j = 0; j < ownedIds.length; ++j) {
          if (giveaway.idType === IdType.APP && giveaway.steamId == ownedIds[j] || giveaway.gameId == ownedIds[j]) {
            log("I seem to own '%s' (gameId: '%s')", giveaway.name, giveaway.gameId);
            giveaway.owned = true;
            break;
          }
        }
        if (!giveaway.owned) {
          log("I don't seem to own '%s' (gameId: '%s')", giveaway.name, giveaway.gameId);
          giveaway.owned = false;
        }
      }
      return giveaways;
    });
  }

  /**
   * iterates through each giveaway and enters them, if possible and desired
   */
  function enterGiveaways (giveaways) {
    log("Entering giveaways", giveaways);
    return eachSeries(giveaways, function (giveaway) {
      if (!giveaway.shouldEnter()) {
        return $.when();
      }
      return giveaway.enter().then(function (payload) {
        log("giveaway entered", "payload", payload);
        if (payload.status === "ok") {
          setCoins(payload.new_amount);
          incrementEnteredGiveaways();
        } else {
          error("Failed to enter giveaway. Status: %s. Giveaway: %o. State: %o", payload.status, giveaway, state);
          if (payload.status === "insufficient_credit") {
            //we know that our coins value is lower than the price to enter this giveaway, so we can set a guessed value
            if (isNaN(state.coins)) {
              setCoins(giveaway.price - 1);
            } else {
              setCoins(Math.min(state.coins, giveaway.price - 1));
            }
          }
        }
      });
    });
  }

  /**
   * utility function to call promises successively
   */
  function eachSeries (collection, action) {
    if (!Array.isArray(collection)) {
      return $.when();
    }
    var currentIndex = 0;
    function callNext () {
      if (currentIndex >= collection.length) {
        return $.when();
      }
      return $.when(action(collection[currentIndex++])).then(callNext);
    }
    return callNext();
  }

  function log () {
    if (!options.debug) {
      return;
    }
    console.log.apply(console, arguments);
  }

  function error () {
    if (!options.debug) {
      return;
    }
    console.error.apply(console, arguments);
  }

  function info () {
    if (!options.debug) {
      return;
    }
    console.info.apply(console, arguments);
  }

  function warn () {
    if (!options.debug) {
      return;
    }
    console.warn.apply(console, arguments);
  }

  /**
   * whether or not a game by name is in the blacklist
   */
  function isInGameBlacklist (name) {
    return isInBlacklist(options.gameBlacklist, name);
  }

  /**
   * whether or not a user by name is in the blacklist
   */
  function isInUserBlacklist (name) {
    return isInBlacklist(options.userBlacklist, name);
  }

  /**
   * utility function that checks if a name is in a blacklist
   */
  function isInBlacklist(blacklist, name) {
    if (!Array.isArray(blacklist)) {
      return false;
    }
    for (var i = 0; i < blacklist.length; ++i) {
      var blacklistItem = blacklist[i];
      if (blacklistItem instanceof RegExp) {
        if (blacklistItem.test(name)) {
          return true;
        }
      } if (name === blacklistItem) {
        return true;
      }
    }
    return false;
  }

  /**
   * Giveaway constructor
   */
  function Giveaway (props) {
    for (var key in props) {
      if (props.hasOwnProperty(key)) {
        this[key] = props[key];
      }
    }
  }

  /**
   * returns true if the script can and should enter a giveaway
   */
  Giveaway.prototype.shouldEnter = function () {
    if (this.entered) {
      log("Not entering '%s' because I already entered", this.name);
      return false;
    }
    if (this.owned && !options.joinOwnedGames) {
      log("Not entering '%s' because I already own it (joinOwnedGames? %s)", this.name, !!options.joinOwnedGames);
      return false;
    }
    if (isInGameBlacklist(this.name)) {
      log("Not entering '%s' because this game is on my blacklist", this.name);
      return false;
    }
    if (isInUserBlacklist(this.by)) {
      log("Not entering '%s' because the user '%s' is on my blacklist", this.name, this.by);
      return false;
    }
    if (!this.guaranteed && options.onlyEnterGuaranteed) {
      log("Not entering '%s' because the key is not guaranteed to work (onlyEnterGuaranteed? %s)", this.name, !!options.onlyEnteredGuaranteed);
      return false;
    }
    if (options.maxParticipants && this.participants > options.maxParticipants) {
      log("Not entering '%s' because too many are participating (participants: %s, max: %s)", this.name, this.participants, options.maxParticipants);
      return false;
    }
    if (this.idType === IdType.SUB && options.skipSubGiveaways) {
      log("Not entering '%s' because this giveaway is linked to a sub (skipSubGiveaways? %s)", this.name, !!options.skipSubGiveaways);
      return false;
    }
    if (this.minLevel > state.level) {
      log("Not entering '%s' because my level is insufficient (mine: %s, needed: %s)", this.name, state.level, this.minLevel);
      return false;
    }
    if (this.price > state.coins) {
      log("Not entering '%s' because my funds are insufficient (mine: %s, needed: %s)", this.name, state.coins, this.price);
      return false;
    }
    return true;
  };

  /**
   * sends a POST-request to enter a giveaway
   */
  Giveaway.prototype.enter = function () {
    info("Entering giveaway", this);
    return request({
      method: "POST",
      url: "/giveaways/new_entry",
      data: JSON.stringify({giv_id: this.id, ticket_price: this.price})
    });
  };

  var IdType = {
    APP: "APP",
    SUB: "SUB"
  };

  var LEVEL_PATTERN = /LEVEL ([0-9]+)/;
  var PARTICIPANTS_PATTERN = /([0-9]+) participants/;
  var APP_ID_PATTERN = /^([0-9]+)(?:_(?:bonus|promo|ig))?$/;
  var SUB_ID_PATTERN = /^sub_([0-9]+)$/;
  var FALLBACK_ID_PATTERN = /([0-9]+)/;
  /**
   * parses the DOM and extracts the giveaway. Returns Giveaway-Objects, which include the following properties:
   id {String} - the giveaway id
   name {String} - name of the game
   price {Integer} - the coins needed to enter the giveaway
   minLevel {Integer} - the minimum level to enter the giveaway
   participants {Integer} - the current number of participants, that entered that giveaway
   guaranteed {Boolean} - whether or not the giveaway is a guaranteed one
   by {String} - name of the user who created the giveaway
   entered {Boolean} - wheter or not the logged in user has already entered the giveaway
   steamId {String} - the id Steam gave this game
   idType {"APP" | "SUB" | null} - "APP" if the steamId is an appId. "SUB" if the steamId is a subId. null if this script is not sure
   gameId {String} - the gameId IndieGala gave this game. It's usually the appId with or without a suffix, or the subId with a "sub_"-prefix
   */
  function getGiveaways ($html) {
    var giveawayDOMs = $(".col-xs-6.tickets-col .ticket-cont", $html);
    var giveaways = [];
    for (var i = 0; i < giveawayDOMs.length; ++i) {
      var giveawayDOM = giveawayDOMs[i];
      var infoText = $(".price-type-cont .right", giveawayDOM).text();
      var gameId = $(".giveaway-game-id", giveawayDOM).attr("value");
      var match;
      var steamId = null;
      var idType = null;
      if (match = APP_ID_PATTERN.exec(gameId)) {
        steamId = match[1];
        idType = IdType.APP;
      } else if (match = SUB_ID_PATTERN.exec(gameId)) {
        steamId = match[1];
        idType = IdType.SUB;
      } else {
        error("Unrecognized id type in '%s'", gameId);
        if (match = FALLBACK_ID_PATTERN.exec(gameId)) {
          steamId = match[1];
        }
      }
      giveaways.push(new Giveaway({
        id: $(".ticket-right .relative", giveawayDOM).attr("rel"),
        name: $(".game-img-cont a", giveawayDOM).attr("title"),
        price: parseInt($(".ticket-price strong", giveawayDOM).text()),
        minLevel: parseInt(LEVEL_PATTERN.exec(infoText)[1]),
        owned: undefined, //will be filled in later in setOwned()
        participants: parseInt(PARTICIPANTS_PATTERN.exec($(".ticket-info-cont .fa.fa-users", giveawayDOM).parent().text())[1]),
        guaranteed: infoText.indexOf("not guaranteed") === -1,
        by: $(".ticket-info-cont .steamnick a", giveawayDOM).text(),
        entered: $(".ticket-right aside", giveawayDOM).length === 0,
        steamId: steamId,
        idType: idType,
        gameId: gameId
      }));
    }
    return giveaways;
  }

  function delay (fn, timeout) {
    return $.Deferred(function (d) {
      setTimeout(function () {
        fn().then(function (value) {
          d.resolve(value);
        });
      }, timeout);
    });
  }

  start();
})();
