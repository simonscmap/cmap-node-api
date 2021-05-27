// Error mapping for queryHandler

const errorCodeMap = {
    ECANCEL: 'Request cancelled.',
    EREQUEST: ''
}

module.exports = (errorObject) => {
    let err;

    switch(errorObject.code){
        case 'ECANCEL':
            err = 'The request was cancelled';
            break;

        case 'EREQUEST':
            err = (errorObject.originalError && errorObject.originalError.info) && errorObject.originalError.info.message;
            break;

        default:
            err = 'An unknown error occured';
            break;
    }

    if(!err) err = 'An unknown error occured';

    return err;    
}