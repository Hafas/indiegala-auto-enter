## Release Notes
*2.6.1*
* Acquiring user data (`my.coins` & `my.level`) should now work more reliably

*2.6.0*
* Options are now configurable over GreaseMonkey's menu
* `my.level` defaults to `10` (instead of `0`) if unable to determine the actual value

*2.5.0*
* Option `minLevel` added
* Set `my.level` to a guessed value when trying to enter a giveaway with insufficient level
* Fix: Set `my.coins` to a guessed value when trying to a giveaway with insufficient coins

*2.4.6*
* Don't send cookies to the Steam API (Family View interferes otherwise)

*2.4.4*
* Fix: Response to layout changes

*2.4.3*
* Fix: Continue if user data request fails

*2.4.2*
* Fix: Response to layout changes

*2.4.1*
* Fix: Option `extraTickets` didn't work as expected

*2.4.0*
* Retrieve `my.coins` and `my.level` through the sidebar (instead of making additional ajax requests)
* `my.nextRecharge` is fixed at 60 minutes
* Option `extraTickets` added

*2.3.0*
* Added option `delay`

*2.2.2*
* FIX: Option `"missing_basegame"` didn't work properly

*2.2.1*
* Possible fix for stuck navigation

*2.2.0*
* Added options `skipDLCs` and `maxPrice`
* Add delay before reloading on error

*2.1.2*
* Added a `@connect` statement
* Made adjustments for ViolentMonkey

*2.1.1*
* FIX: Forgot to actually use `skipOwnedGames` instead of `joinOwnedGames`

*2.1.0*
* `joinOwnedGames` removed
* Options `skipOwnedGames`, `steamApiKey` and `steamUserId` added (see [Options](#options) for more information)

*2.0.2*
* Handling of 'Whooops! Something went wrong.'

*2.0.1*
* Added measure to react to slight DOM changes

*2.0.0*
* Rewrite to get rid of jQuery-Dependency. Firefox 52+ or Chrome 55+ is now needed to use this script.
* Fixes due to DOM changes

*1.1.12*
Fixes due to minor DOM changes

*1.1.11*
Fixes due to minor DOM changes and due giveaways now being fetched on the client-side

*1.1.10*
IndieGala now blocks fast consecutive requests, so a delay after a blocked requests (1 minute) has been implemented

*1.1.9*
* If the user is on level 0 we are requesting a filtered page by this level (by [Tiago Danin](https://github.com/TiagoDanin))
* When the server responds with `insufficient_credit` (usually happens when we are defaulting the coins to 240), we are now setting the user's coins to the giveaway's price minus 1

*1.1.8*
* FIX: If the available coins cannot be determined then assume the user has 240 coins (instead of 0)

*1.1.7*
* FIX: When the request to `/profile` fails, the script doesn't crash anymore. Furthermore the request won't be retried anymore and a default value for `my.nextRecharge` will be set (20 min)
* `my.coins` are now retrieved from the current giveaway page instead of from `/profile`

*1.1.6* readded `joinOwnedGames`

*1.1.5* Coins and recharge time are now fetched from the profile page instead, since IndieGala changed the API of `/get_user_level_and_coins` (fixed by [Yuping Zuo](https://github.com/zypA13510))

*1.1.4* Added features to prevent some reasons the script may get stuck:
* IndieGala's issues are being displayed in `alerts` which stops the script until okayed. If `interceptAlert` is set to true, the script will intercept and ignore these messages.
* The script used to travel past the last giveaway page and go further and further and further and further and ... When reaching the last page, it will now return to the first page instead. See `waitOnEnd`.
* Sometimes IndieGala seems to be under heavy load and doesn't respond to some requests. The script will now retry if a requests fails or times out. See `timeout`.
* removed `joinOwnedGames`

*1.1.3*
* Some log changes.
* When asking for owned games, don't ask with gameId as IndieGala does, but with the appId if available.
* Code more documented
* Stop script when not on a giveaway list page (e.g. a details page)

*1.1.2* We are asking IndieGala directly if a game is owned to prevent a race condition between this script and IndieGala's subsequent render of the blue Steam-corner

*1.1.1* replaced `skipImagelessGiveaway` with `skipSubGiveaways`

*1.1.0* `skipImagelessGiveaway` added. Blacklists can now contain regular expressions.

*1.0.4* `shouldEnter` checks reordered

*1.0.3* Unused function `waitForRecharge` removed

*1.0.2* Check before navigating to the next page, if there are coins to spend. If not, don't navigate and wait for recharge.

*1.0.1* Additional log outputs

*1.0.0* Initial Release
