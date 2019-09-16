module.exports = controllerFunction => (req, res, next) => {
    Promise.resolve(controllerFunction(req, res, next)).catch(err => {
        console.log(err);
        next(err);
    });
}