module.exports = controllerFunction => (req, res, next) => {
    Promise.resolve(controllerFunction(req, res, next)).catch(err => next(err));
}