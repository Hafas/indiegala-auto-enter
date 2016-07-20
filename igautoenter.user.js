// ==UserScript==
// @name         IndieGala: Auto-enter Giveaways
// @version      1.1.2
// @description  Automatically enters IndieGala Giveaways
// @author       Hafas (https://github.com/Hafas/)
// @match        https://www.indiegala.com/giveaways*
// @grant        none
// ==/UserScript==

var options = {
  joinOwnedGames: false,
  //set to 0 to ignore the number of participants
  maxParticipants: 0,
  //Array of names of games
  gameBlacklist: [],
  onlyEnterGuaranteed: false,
  //Array of names of users
  userBlacklist: [],
  //Some giveaways don't link to the game directly but to a sub containg that game. IndieGala is displaying these games as "not owned" even if you own that game
  skipSubGiveaways: false,
  //Display logs
  debug: false
};

var my = {
  level: undefined,
  coins: undefined,
  nextRecharge: undefined
};

function start () {
  getUserData().done(function (payload) {
    setData(payload);
    if (!okToContinue()) {
      return;
    }
    var giveaways = getGiveaways();
    return setOwned(giveaways).then(enterGiveaways).then(function () {
      if (okToContinue()) {
        navigateToNext();
      }
    });
  }).fail(function (err) {
    error("Something went wrong:", err);
  });
}

var IdType = {
  APP: "APP",
  SUB: "SUB"
};

function okToContinue () {
  if (my.coins === 0) {
    info("No coins available. Waiting for recharge. Expected recharge at", new Date(new Date().getTime() + my.nextRecharge));
    setTimeout(navigateToStart, my.nextRecharge);
    return false;
  }
  return true;
}

function getUserData () {
  return $.ajax({
    url: "/giveaways/get_user_level_and_coins",
    dataType: "json"
  });
}

function setOwned (giveaways) {
  var gameIds = giveaways.map(function (giveaway) {
    if (giveaway.idType === IdType.APP) {
      return giveaway.steamId;
    }
    return giveaway.gameId;
  });
  return $.ajax({
    url: "/giveaways/match_games_in_steam_library",
    type: "POST",
    data: JSON.stringify({
      "games_id": gameIds
    }),
    dataType: "json"
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

function setData (data) {
  log("setData", "data", data);
  my.level = parseInt(data.current_level);
  my.coins = parseInt(data.coins_tot);
  my.nextRecharge = (parseInt(data.minutes_to_next_recharge) + 1) * 60 * 1000;
}

function enterGiveaways (giveaways) {
  log("Entering giveaways", giveaways);
  return eachSeries(giveaways, function (giveaway) {
    if (!giveaway.shouldEnter()) {
      return $.when();
    }
    return giveaway.enter().then(function (payload) {
      log("giveaway entered", "payload", payload);
      if (payload.status === "ok") {
        my.coins = payload.new_amount;
      } else {
        error("Failed to enter giveaway. Status: %s. My: %o", payload.status, my);
      }
    });
  });
}

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

var LEVEL_PATTERN = /LEVEL ([0-9]+)/;
var PARTICIPANTS_PATTERN = /([0-9]+) participants/;
var APP_ID_PATTERN = /^([0-9]+)(?:_(?:bonus|promo|ig))?$/;
var SUB_ID_PATTERN = /^sub_([0-9]+)$/;
var FALLBACK_ID_PATTERN = /([0-9]+)/;
function getGiveaways () {
  var giveawayDOMs = $(".col-xs-6.tickets-col .ticket-cont");
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

function isInGameBlacklist (name) {
  return isInBlacklist(options.gameBlacklist, name);
}

function isInUserBlacklist (name) {
  return isInBlacklist(options.userBlacklist, name);
}

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

function Giveaway (props) {
  for (var key in props) {
    if (props.hasOwnProperty(key)) {
      this[key] = props[key];
    }
  }
}

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
  if (this.minLevel > my.level) {
    log("Not entering '%s' because my level is insufficient (mine: %s, needed: %s)", this.name, my.level, this.minLevel);
    return false;
  }
  if (this.price > my.coins) {
    log("Not entering '%s' because my funds are insufficient (mine: %s, needed: %s)", this.name, my.coins, this.price);
    return false;
  }
  return true;
};

Giveaway.prototype.enter = function () {
  info("Entering giveaway", this);
  return $.ajax({
      url: "/giveaways/new_entry",
      type: "POST",
      data: JSON.stringify({
        giv_id: this.id,
        ticket_price: this.price
      }),
      contentType: "application/json; charset=UTF-8",
      dataType: "json"
  });
};

function navigateToStart () {
  navigateToPage(1);
}

function navigateToNext () {
  navigateToPage(getCurrentPage() + 1);
}

function navigateToPage (pageNumber) {
  var target = "/giveaways/" + pageNumber + "/expiry/asc/level/all";
  log("navigating to", target);
  window.location = target;
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

var PAGE_NUMBER_PATTERN = /giveaways\/([0-9]+)\//;
function getCurrentPage () {
  var currentPath = window.location.pathname;
  var match = PAGE_NUMBER_PATTERN.exec(currentPath);
  if (match === null) {
    return 1;
  }
  return parseInt(match[1]);
}

start();
