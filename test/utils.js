const { utils } = require("ethers/lib");
const { constants } = require("ethers");

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

module.exports = {
  FacetCutAction: this.FacetCutAction,
  getSelectors: this.getSelectors,
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
    facets = [
      await ethers.getContractFactory("Pool"),
      await ethers.getContractFactory("Gov"),
      await ethers.getContractFactory("View"),
      await ethers.getContractFactory("Manager"),
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

    const Pool = await ethers.getContractFactory("Pool");
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
