const { utils } = require("ethers/lib");
const { constants } = require("ethers");
const { expect } = require("chai");
const { parseEther } = require("ethers/lib/utils");

FacetCutAction = {
  Add: 0,
  Replace: 1,
  Remove: 2,
};

function getSelectors(contract) {
  const signatures = [];
  for (const key of Object.keys(contract.functions)) {
    signatures.push(utils.keccak256(utils.toUtf8Bytes(key)).substr(0, 10));
  }
  return signatures;
}

async function errorMsg(i, key, token, need, is) {
  return (
    i +
    ": " +
    key +
    " @ " +
    (await token.name()) +
    ", expected " +
    need +
    " to eq " +
    is
  );
}

module.exports = {
  FacetCutAction: this.FacetCutAction,
  getSelectors: this.getSelectors,
  erc20: async (token, data) => {
    let i = 0;
    for (var key in data) {
      const val = data[key];
      if (typeof val !== "string") {
        throw new Error("wrong type");
      }
      const is = parseEther(val);
      let need;
      if (key == "total") {
        need = await token.totalSupply();
      } else {
        need = await token.balanceOf(key);
      }
      if (!need.eq(is)) {
        throw new Error(await errorMsg(i, key, token, need, is));
      }
      i += 1;
    }
  },
  tvl: async (token, data) => {
    let i = 0;
    for (var key in data) {
      const val = data[key];
      if (typeof val !== "string") {
        throw new Error("wrong type");
      }
      const is = parseEther(val);
      let need;
      if (key == "total") {
        need = await insure.getStakersTVL(token.address);
      } else {
        need = await insure.getStakerTVL(key, token.address);
      }
      if (!need.eq(is)) {
        throw new Error(await errorMsg(i, key, token, need, is));
      }
      i += 1;
    }
  },
  events: async (tx) => {
    tx = await tx;
    tx = await tx.wait();
    return tx.events;
  },
  timestamp: async (tx) => {
    tx = await tx;
    tx = await tx.wait();
    return (await ethers.provider.getBlock(tx.blockNumber)).timestamp;
  },
  insurance: async (owner) => {
    const LibPool = await ethers.getContractFactory("LibPool");
    libPool = await LibPool.deploy();

    const Pool = await ethers.getContractFactory("Pool", {
      libraries: { LibPool: libPool.address },
    });
    facets = [
      Pool,
      await ethers.getContractFactory("Gov"),
      await ethers.getContractFactory("View"),
      await ethers.getContractFactory("Manager", {
        libraries: { LibPool: libPool.address },
      }),
    ];

    diamondCut = [];
    for (let i = 0; i < facets.length; i++) {
      const f = await facets[i].deploy();
      diamondCut.push({
        action: FacetCutAction.Add,
        facetAddress: f.address,
        functionSelectors: getSelectors(f),
      });
    }

    extern = [];
    intern = [];

    const IPool = await ethers.getContractAt("IPool", constants.AddressZero);
    for (property in Pool.interface.functions) {
      const name = Pool.interface.functions[property].name;
      extern.push(IPool.interface.getSighash(name));
      intern.push(Pool.interface.getSighash(name));
    }

    // deploy diamond
    Diamond = await ethers.getContractFactory("Diamond");
    const diamond = await Diamond.deploy(diamondCut, [
      await owner,
      extern,
      intern,
    ]);

    return await ethers.getContractAt("ISolution", diamond.address);
  },
};
