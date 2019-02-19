/**
 * @author [Mingliang Chen]
 * @email [illuspas@gmail.com]
 * @create date 2019-01-20 11:54:20
 * @modify date 2019-01-20 11:54:20
 * @desc [description]
 */

function genSessionID() {
  let sessionID = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWKYZabcdefghijklmnopqrstuvwxyz0123456789';
  const numPossible = possible.length;
  for (let i = 0; i < 16; i++) {
    sessionID += possible.charAt((Math.random() * numPossible) | 0);
  }
  return sessionID;
}

module.exports = {
  genSessionID
};
