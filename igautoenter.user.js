// ==UserScript==
// @name         IndieGala: Auto-enter Giveaways
// @version      1.0.0
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
    if (my.coins === 0) {
      log("No coins available. Waiting for recharge ...");
      return setTimeout(navigateToStart, my.nextRecharge);
    }
    enterGiveaways().then(navigateToNext);
  });
}

function getUserData () {
  return $.get("/giveaways/get_user_level_and_coins");
}

function setData (data) {
  data = JSON.parse(data);
  log("setData", "data", data);
  my.level = parseInt(data.current_level);
  my.coins = parseInt(data.coins_tot);
  my.nextRecharge = (parseInt(data.minutes_to_next_recharge) + 1) * 60 * 1000;
}

function enterGiveaways () {
  var giveaways = getGiveaways();
  return eachSeries(giveaways, function (giveaway) {
    if (!giveaway.shouldEnter()) {
      return $.when();
    }
    return giveaway.enter().then(function (payload) {
      log("giveaway entered", "payload", payload);
      if (payload.status === "ok") {
        my.coins = payload.new_amount;
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
    log("callNext", "currentIndex", currentIndex);
    if (currentIndex >= collection.length) {
      return $.when();
    }
    return $.when(action(collection[currentIndex++])).then(callNext);
  }
  return callNext();
}

var LEVEL_PATTERN = /LEVEL ([0-9]+)/;
var PARTICIPANTS_PATTERN = /([0-9]+) participants/;
function getGiveaways () {
  var giveawayDOMs = $(".col-xs-6.tickets-col .ticket-cont");
  var giveaways = [];
  for (var i = 0; i < giveawayDOMs.length; ++i) {
    var giveawayDOM = giveawayDOMs[i];
    var infoText = $(".price-type-cont .right", giveawayDOM).text();
    giveaways.push(new Giveaway({
      id: $(".ticket-right .relative", giveawayDOM).attr("rel"),
      name: $(".game-img-cont a", giveawayDOM).attr("title"),
      price: parseInt($(".ticket-price strong", giveawayDOM).text()),
      minLevel: parseInt(LEVEL_PATTERN.exec(infoText)[1]),
      owned: $(".on-steam-library-corner", giveawayDOM).css("display") === "block",
      participants: parseInt(PARTICIPANTS_PATTERN.exec($(".ticket-info-cont .fa.fa-users", giveawayDOM).parent().text())[1]),
      guaranteed: infoText.indexOf("not guaranteed") === -1,
      by: $(".ticket-info-cont .steamnick a", giveawayDOM).text(),
      entered: $(".ticket-right aside", giveawayDOM).length === 0
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
    if (name === blacklist[i]) {
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
    return false;
  }
  if (this.minLevel > my.level) {
    return false;
  }
  if (isInGameBlacklist(this.name)) {
    return false;
  }
  if (this.price > my.coins) {
    return false;
  }
  if (this.owned && !options.joinOwnedGames) {
    return false;
  }
  if (options.maxParticipants && this.participants > options.maxParticipants) {
    return false;
  }
  if (!this.guaranteed && options.onlyEnterGuaranteed) {
    return false;
  }
  if (isInUserBlacklist(this.by)) {
    return false;
  }
  return true;
};

Giveaway.prototype.enter = function () {
  log("Entering giveaway", this.id, this.name);
  return $.ajax({
      url: "/giveaways/new_entry",
      type: "POST",
      data: JSON.stringify({
        giv_id: this.id,
        ticket_price: this.price
      }),
      contentType: "application/json; charset=UTF-8"
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