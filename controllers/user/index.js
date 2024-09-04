const addCartItem = require("./addCartItem");
const changeEmail = require("./changeEmail");
const changePassword = require("./changePassword");
const choosePassword = require("./choosePassword");
const clearCart = require("./clearCart");
const contactUs = require("./contactUs");
const forgotPassword = require("./forgotPassword");
const generateAPIKey = require("./generateAPIKey");
const getCart = require("./getCart");
const getGuestToken = require("./getGuestToken");
const googleAuth = require("./googleAuth");
const removeCartItem = require("./removeCartItem");
const retrieveAPIKeys = require("./retrieveAPIKeys");
const signIn = require("./signIn");
const signOut = require("./signOut");
const signUp = require("./signUp");
const updateInfo = require("./updateInfo");
const validate = require("./validate");
const lastApiCall = require("./lastApiCall");
const getSubscriptions = require("./getSubscriptions");
const createSubscription = require("./createSubscription");
const deleteSubscriptions = require("./deleteSubscriptions");

module.exports = {
  addCartItem, // TODO deprecate this
  changeEmail,
  changePassword,
  choosePassword,
  clearCart, // TODO deprecate this
  contactUs,
  forgotPassword,
  generateAPIKey,
  getCart, // TODO deprecate this
  getGuestToken,
  googleAuth,
  lastApiCall,
  removeCartItem, // TODO deprecate this
  retrieveAPIKeys,
  signIn,
  signOut,
  signUp,
  updateInfo,
  validate,
  getSubscriptions,
  createSubscription,
  deleteSubscriptions,
}
