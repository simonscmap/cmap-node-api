const router = require('express').Router();
const userController = require('../controllers/user');
const passport = require('../middleware/passport');

const asyncControllerWrapper = require('../errorHandling/asyncControllerWrapper');

// Signup route
router.post('/signup', asyncControllerWrapper(asyncControllerWrapper(userController.signup)));

// Signin route
router.post('/signin', passport.authenticate('local', {session:false}), asyncControllerWrapper(userController.signin));

// Validation route used by the app to confirm unique username and email
router.post('/validate', asyncControllerWrapper(userController.validate));

// Logout route used by app to destroy cookies
router.get('/signout', asyncControllerWrapper(userController.signout));

// Route to create new API key
router.get('/generateapikey', passport.authenticate('jwt', {session:false}), asyncControllerWrapper(userController.generateApiKey));

// Route to retrieve current API keys
router.get('/retrieveapikeys', passport.authenticate('jwt', {session:false}), asyncControllerWrapper(userController.retrieveApiKeys));

// Route to update user information
router.post('/updateinfo', passport.authenticate('jwt', {session:false}), asyncControllerWrapper(userController.updateInfo));

// Route used for Google SSO
router.post('/googleauth', asyncControllerWrapper(userController.googleAuth));

// Route for handling forgotten password requests
router.post('/forgotpassword', asyncControllerWrapper(userController.forgotPassword));

// Route for sending confirmation email
router.post('/confirmemail', asyncControllerWrapper(userController.confirmEmail));

// Route for accepting password changes
router.post('/choosepassword', asyncControllerWrapper(userController.choosePassword));

// Route for transmitted submitted contact us forms
router.post('/contactus', asyncControllerWrapper(userController.contactUs));

// Route for transmitted submitted contact us forms
router.post('/changeemail', passport.authenticate('local', {session:false}), asyncControllerWrapper(userController.changeEmail));

// Route for transmitted submitted contact us forms
router.post('/changepassword', passport.authenticate('local', {session:false}), asyncControllerWrapper(userController.changePassword));

module.exports = router;