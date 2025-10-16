const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Deploying LostAndFound contract to Base Mainnet...");

  const LostAndFound = await hre.ethers.getContractFactory("LostAndFound");
  const lostAndFound = await LostAndFound.deploy();

  await lostAndFound.waitForDeployment();

  const address = await lostAndFound.getAddress();

  console.log(`LostAndFound deployed to: ${address}`);
  console.log(`View on BaseScan: https://basescan.org/address/${address}`);

  // Wait for a few block confirmations
  console.log("Waiting for block confirmations...");
  await lostAndFound.deploymentTransaction().wait(5);

  console.log("Deployment completed!");

  // Save deployment info
  const deploymentInfo = {
    contractAddress: address,
    network: "base",
    chainId: 8453,
    deployedAt: new Date().toISOString(),
    explorerUrl: `https://basescan.org/address/${address}`
  };

  fs.writeFileSync(
    'deployment-info.json',
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("Deployment info saved to deployment-info.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
