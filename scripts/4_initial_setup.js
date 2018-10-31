const { StateUpdater, getNetworkId, } = require('./state-updater')
const STAGE_NTR1X_NETWORK_ID = 88

module.exports = async (callback) => {
    const networkId = await getNetworkId(web3);
    console.info(`Got network ${networkId}`)

    let secrets

    if (networkId > 1000) { // means we in dev network
        secrets = require('../keystore/secrets-dev.json')
    }
    else if (networkId === STAGE_NTR1X_NETWORK_ID) {
        secrets = require('../keystore/secrets.json')
    }
    else {
        throw new Error(`Provide valid secrets config for current network or decline using this script`);
    }

    const stateUpdater = new StateUpdater(web3, artifacts, secrets);
    await stateUpdater.initialize();

    await stateUpdater.setRootAddresses();
    await stateUpdater.presetupRolesAccess();
    await stateUpdater.setupFirstBoard();

    callback();
}