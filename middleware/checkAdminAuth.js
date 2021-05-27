// Middleware to blocked potential spoofed admin requests

module.exports = (req, res, next) => {
    if(!req.user.isDataSubmissionAdmin){
        return res.sendStatus(401);
    }

    else {
        next();
    }
}