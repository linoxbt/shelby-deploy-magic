const { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } = require("@aptos-labs/ts-sdk");

async function deploy() {
  const config = new AptosConfig({
    network: Network.TESTNET,
    fullnode: "https://aptos.testnet.porto.aptoslabs.com/v1",
  });
  const aptos = new Aptos(config);

  const privateKey = new Ed25519PrivateKey(
    "0x4e7065a4949f30b76ba91f10a3ef1d2a2fbae2e37dbf34da4feb4e8571a9eced",
  );
  const account = Account.fromPrivateKey({ privateKey });

  console.log(`Deploying from address: ${account.accountAddress}`);

  // Compiled hex bytecode
  const moduleHex =
    "a11ceb0b0500000006010002020204030605050b1d07281f084720000000010000000103000672656769737472790f5368656c627952656769737472790c636f6e74656e745f68617368046e616d650f72656769737465725f70726f6a6563740000000000000000000000000000000000000000000000000000000000000001000001000b000b0100000201010003010100000001040100000000000000000000000000000000000000000000000000000000000000010872656769737472790f5368656c62795265676973747279000102000201";
  const bytecode = Uint8Array.from(Buffer.from(moduleHex, "hex"));

  try {
    console.log("Building transaction...");
    // Using the more explicit transaction builder
    const transaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: "0x1::code::publish_package_bundle",
        functionArguments: [
          Uint8Array.from(Buffer.from("010000", "hex")), // metadata: simplified
          [bytecode],
        ],
      },
    });

    console.log("Signing and submitting...");
    const pendingTxn = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction,
    });

    console.log(`Transaction submitted: ${pendingTxn.hash}`);
    console.log("Waiting for confirmation...");

    const response = await aptos.waitForTransaction({ transactionHash: pendingTxn.hash });

    if (response.success) {
      console.log("-----------------------------------------");
      console.log("✅ Registry Contract Deployed Successfully!");
      console.log(`Address: ${account.accountAddress}`);
      console.log("-----------------------------------------");
    } else {
      console.log("❌ Transaction failed!");
      console.log(response.vm_status);
    }
  } catch (error) {
    console.error("Error during deployment:", error);
  }
}

deploy();
