const router = require('express').Router();
const userController = require('../controllers/user/');
const passport = require('../middleware/passport');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');

// Signup route
router.post('/signup', asyncControllerWrapper(userController.signUp));

// Signin route
router.post(
  '/signin',
  passport.authenticate('local', { session: false }),
  asyncControllerWrapper(userController.signIn),
);

// Validation route used by the app to confirm unique username and email
router.post('/validate', asyncControllerWrapper(userController.validate));

// Logout route used by app to destroy cookies
router.get('/signout', asyncControllerWrapper(userController.signOut));

// Route to create new API key
router.get(
  '/generateapikey',
  passport.authenticate('jwt', { session: false }),
  asyncControllerWrapper(userController.generateAPIKey),
);

// Route to retrieve current API keys
router.get(
  '/retrieveapikeys',
  passport.authenticate('jwt', { session: false }),
  asyncControllerWrapper(userController.retrieveAPIKeys),
);

// Route to update user information
router.post(
  '/updateinfo',
  passport.authenticate('jwt', { session: false }),
  asyncControllerWrapper(userController.updateInfo),
);

// Route used for Google SSO
router.post('/googleauth', asyncControllerWrapper(userController.googleAuth));

// Route for handling forgotten password requests
router.post(
  '/forgotpassword',
  asyncControllerWrapper(userController.forgotPassword),
);

// Route for sending confirmation email
router.post(
  '/confirmemail',
  asyncControllerWrapper(userController.confirmEmail),
);

// Route for accepting password changes
router.post(
  '/choosepassword',
  asyncControllerWrapper(userController.choosePassword),
);

// Route for transmitted submitted contact us forms
router.post('/contactus', asyncControllerWrapper(userController.contactUs));

router.post(
  '/changeemail',
  passport.authenticate('local', { session: false }),
  asyncControllerWrapper(userController.changeEmail),
);

// Route for transmitted submitted contact us forms
router.post(
  '/changepassword',
  passport.authenticate('local', { session: false }),
  asyncControllerWrapper(userController.changePassword),
);

// routes for managing persistent cart items
router.post(
  '/addcartitem',
  passport.authenticate('jwt', { session: false }),
  asyncControllerWrapper(userController.addCartItem),
);
router.post(
  '/removecartitem',
  passport.authenticate('jwt', { session: false }),
  asyncControllerWrapper(userController.removeCartItem),
);
router.get(
  '/clearcart',
  passport.authenticate('jwt', { session: false }),
  asyncControllerWrapper(userController.clearCart),
);
router.get(
  '/getcart',
  passport.authenticate('jwt', { session: false }),
  asyncControllerWrapper(userController.getCart),
);

router.get(
  '/getguesttoken',
  passport.authenticate('browserOnly', { session: false }),
  asyncControllerWrapper(userController.getGuestToken),
);

router.get(
  '/last-api-call',
  passport.authenticate('jwt', { session: false }),
  asyncControllerWrapper(userController.lastApiCall),
);

router.get(
  '/subscriptions',
  passport.authenticate('jwt', { session: false }),
  asyncControllerWrapper(userController.getSubscriptions),
);

router.post(
  '/subscriptions',
  passport.authenticate('jwt', { session: false }),
  asyncControllerWrapper(userController.createSubscription.controller),
);

router.delete(
  '/subscriptions',
  passport.authenticate('jwt', { session: false }),
  asyncControllerWrapper(userController.deleteSubscriptions),
);

module.exports = router;
