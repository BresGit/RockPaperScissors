const RockPaper = artifacts.require("RockPaperScissors");

module.exports = function(deployer) {
  deployer.deploy(RockPaper);
};
