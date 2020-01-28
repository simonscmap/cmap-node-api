var protobuf = require("protobufjs");

var protoInit = async() => {
    var root = await protobuf.load('proto/SpaceTimeRow.proto');

    return {
        SpaceTimeRow: root.lookupType('spacetimepackage.SpaceTimeRow')
    }
}

module.exports = protoInit();