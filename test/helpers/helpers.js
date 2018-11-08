"use strict";

const Asserts = require('./asserts');
const Roles2LibraryInterface = artifacts.require('./Roles2LibraryInterface.sol');
const roles2LibraryInterface = web3.eth.contract(Roles2LibraryInterface.abi).at('0x0');
const asserts = Asserts(assert);
const { randomBytes } = require('crypto');

Array.prototype.unique = function() {
  return this.filter(function (value, index, self) {
      return self.indexOf(value) === index;
  });
}

Array.prototype.removeZeros = function() {
  return this.filter(function (value, index, self) {
      return value != 0x0 && value != 0 && value.valueOf() != '0'
  });
}


const helpers = {
  getRandomBytes32: () => {
   return `0x${randomBytes(32).toString("hex")}`
  },
  getSig: (callData) => web3.sha3(callData).slice(0, 10),
  increaseTime: (time) => {
    return new Promise((resolve, reject) => {
      web3.currentProvider.sendAsync({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [time],
        id: new Date().getTime()
      }, (error, result) => error ? reject(error) : resolve(result.result))
    });
  },
  mine: () => {
    return new Promise((resolve, reject) => {
      web3.currentProvider.sendAsync({
        jsonrpc: "2.0",
        method: "evm_mine",
        id: new Date().getTime()
      }, (error, result) => error ? reject(error) : resolve(result.result))
    });
  },
  assertExpectations: (mock, expected = 0, callsCount = null) => {
    let expectationsCount;
    return () => {
      return mock.expectationsLeft()
      .then(asserts.equal(expected))
      .then(() => mock.expectationsCount())
      .then(result => expectationsCount = result)
      .then(() => mock.callsCount())
      .then(result => asserts.equal(callsCount === null ? expectationsCount : callsCount)(result));
    };
  },

  ignoreAuth: (mock, enabled = true) => {
    return mock.ignore(roles2LibraryInterface.canCall.getData().slice(0, 10), enabled);
  },
  getBitFlag: index => {
    return web3.toBigNumber(2).pow(index);
  },
  getFlag: index => {
    return web3.toBigNumber(2).pow(index*2);
  },
  getOddFlag: index => {
    return web3.toBigNumber(4).pow(index);
  },
  getEvenFlag: index => {
    return web3.toBigNumber(2).pow(index*2 + 1);
  },
  eventEquals: (tx, event) => {
    assert.equal(tx.logs[0].event, event);
  },
  error: (tx, events, contract, text) => {
      const logs = tx.logs;

      for (logEntry of logs) {
          if (logEntry.event.toLowerCase() == "error") {
              assert.equal(logEntry.address, events.address);
              assert.equal(logEntry.event, "Error");
              assert.equal(logEntry.args.self, contract.address);
              assert.isTrue(web3.toAscii(logEntry.args.msg).includes(text));
          }
      }
  },
  assertLogs: (logs) => {
    return (tx) => {
      assert.equal(tx.logs.length, logs.length);
      for (let i in logs) {
        let log = logs[i];
        if (log.address) {
          assert.equal(tx.logs[i].address, log.address);
        }
        if (log.event) {
          assert.equal(tx.logs[i].event, log.event);
        }
        for (let a in log.args) {
          if (typeof log.args[a] === "array" || typeof log.args[a] === "object") {
            // Compare array lengths and contents
            assert.equal(tx.logs[i].args[a].length, log.args[a].length);
            for (let m in tx.logs[i].args[a]) {
              assert.equal(tx.logs[i].args[a][m], log.args[a][m]);
            }
          } else {
            assert.equal(tx.logs[i].args[a], log.args[a]);
          }
        }
      }
    }
  },
  assertJump: (error) => {
    assert.isAbove(error.message.search('invalid opcode'), -1, 'Invalid opcode error must be returned');
  },
}

helpers.getEthBalance = acc => new Promise((resolve, reject) => {
  web3.eth.getBalance(acc, (e, b) => (e === undefined || e === null) ? resolve(web3.toBigNumber(b)): reject(e))
})

helpers.getTx = hash => new Promise((resolve, reject) => {
  web3.eth.getTransaction(hash, (e, tx) => (e === undefined || e === null) ? resolve(tx) : reject(e))
})

helpers.getTxReceipt = hash => new Promise((resolve, reject) => {
  web3.eth.getTransactionReceipt(hash, (e, tx) => (e === undefined || e === null) ? resolve(tx) : reject(e))
})

helpers.getTxExpences = async hash => {
  const fullTx = await helpers.getTx(hash)
  const receiptTx = await helpers.getTxReceipt(hash)

  return web3.toBigNumber(fullTx.gasPrice).mul(web3.toBigNumber(receiptTx.gasUsed))
}

module.exports = helpers
