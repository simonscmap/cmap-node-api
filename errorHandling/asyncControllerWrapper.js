// Wrapper to catch error in async functions

module.exports = controllerFunction => (req, res, next) => {
    Promise.resolve(controllerFunction(req, res, next)).catch(err => {
        console.log('error in async controller wrapper', err);
        next(err);
    });
}
