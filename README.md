# indiegala-auto-enter
A script to automatically enter Giveaways on IndieGala

## Options
Edit the script to change the `options`-Object

* `joinOwnedGames` {`Boolean`} - whether or not you also want to auto-enter giveaways of owned games
* `maxParticipants` {`Integer`} - set it to a value greater than `0` if you don't want to auto-enter giveaways that already have at least `maxParticipants` participants
* `gameBlacklist` {`Array<String>`} - add names of games to this array if you don't want to auto-enter specific games (e.g. DLCs IndieGala doesn't recognized as owned)
* `onlyEnterGuaranteed` {`Boolean`} - whether or not you only want to auto-enter guaranteed giveaways
* `userBlacklist` {`Array<String>`} - add names of users to this array if you don't want to auto-enter their giveaways
* `debug` {`Boolean`} - set to `true` if you want to see log output of this script in the console

## Disclaimer
I don't take any responsibility for damage caused by this software. Use this software at your own risk.
