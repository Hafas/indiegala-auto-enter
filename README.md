# indiegala-auto-enter
A script to automatically enter Giveaways on IndieGala

## Installation
Install Tampermonkey and then click [here](https://github.com/Hafas/indiegala-auto-enter/raw/master/igautoenter.user.js).

## Options
Edit the script to change the `options`-Object

* `joinOwnedGames` {`Boolean`} - whether or not to auto-enter giveaways of owned games
* `maxParticipants` {`Integer`} - set it to a value greater than `0` if you don't want to auto-enter giveaways that already have at least `maxParticipants` participants
* `gameBlacklist` {`Array<String/RegExp>`} - add names of games to this array if you don't want to auto-enter specific games (e.g. DLCs IndieGala doesn't recognized as owned or DLCs of games you don't own)
* `onlyEnterGuaranteed` {`Boolean`} - whether or not to only auto-enter guaranteed giveaways
* `userBlacklist` {`Array<String/RegExp>`} - add names of users to this array if you don't want to auto-enter their giveaways
* `skipSubGiveaways` {`Boolean`} - whether or not to auto-enter giveaways that are linked to subs. Those games are usually not recognized correctly as owned. *Added in `1.1.1`.*
* `debug` {`Boolean`} - set to `true` if you want to see log output of this script in the console

If there is an update, backup the options first. It will be overwritten otherwise.

## Disclaimer
I don't take any responsibility for damage caused by this software. Use this software at your own risk.

## Release Notes
*1.1.1* replaced `skipImagelessGiveaway` with `skipSubGiveaways`

*1.1.0* `skipImagelessGiveaway` added. Blacklists can now contain regular expressions.

*1.0.4* `shouldEnter` checks reordered

*1.0.3* Unused function `waitForRecharge` removed

*1.0.2* Check before navigating to the next page, if there are coins to spend. If not, don't navigate and wait for recharge.

*1.0.1* Additional log outputs

*1.0.0* Initial Release
