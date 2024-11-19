import React, { useState } from 'react';
import logo from './logo.svg';
import './App.css';
import { TextInput, Button } from '@0xsequence/design-system';
import { ethers } from 'ethers'
import { sequence } from '0xsequence';
// @ts-ignore
import Papa from 'papaparse';

// Initialize the provider and sequence
const provider = new ethers.providers.JsonRpcProvider(`https://nodes.sequence.app/sepolia/${process.env.REACT_APP_PROJECT_ACCESS_KEY}`);

const marketplaceContractAddress = '0xB537a160472183f2150d42EB1c3DD6684A55f74c';

sequence.initWallet(process.env.REACT_APP_PROJECT_ACCESS_KEY!, { defaultNetwork: 11155111 });

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [requests, setRequests] = useState([]);

  const connect = async () => {
    const wallet = sequence.getWallet();
    const details = await wallet.connect({ app: 'request app' });
    if (details.connected) {
      setIsLoggedIn(true);
    }
  };

  const handleFileUpload = (event: any) => {
    const file = event.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        complete: (results: any) => {
          const formattedRequests = results.data.map((row: any) => (
            {
            isListing: row.isListing === 'TRUE',
            isERC1155: row.isERC1155 === 'TRUE',
            tokenContract: row.collectionAddress,
            tokenId: parseInt(row.tokenId, 10),
            quantity: parseInt(row.quantity, 10),
            expiry: Date.now() + 60*60*parseInt(row.expiry, 10),
            currency: row.currency,
            pricePerToken: ethers.utils.parseUnits(String(row.price), 18),
          }
        ));
          console.log(formattedRequests)
          setRequests(formattedRequests);
        },
      });
    }
  };

    const approveMarketplaceContract = async () => {
        const erc1155Interface = new ethers.utils.Interface([
            "function setApprovalForAll(address _operator, bool _approved) returns ()",
        ]);

        const dataApprove = erc1155Interface.encodeFunctionData(
            'setApprovalForAll',
            [marketplaceContractAddress, true]
        );

        const txn = {
            to: marketplaceContractAddress,
            data: dataApprove
        };

        const signer = await getSigner();
        const res = await signer.sendTransaction(txn);
        console.log(res);
    }

    const getSigner = async() => {
        const wallet = sequence.getWallet();
        return wallet.getSigner('sepolia');
    }

  const clickCreateRequest = async () => {
    if (requests.length === 0) {
        console.log("No requests to process. Please upload a CSV file.");
        return;
    }

    const sequenceMarketInterface = new ethers.utils.Interface([
        "function createRequestBatch(tuple(bool isListing, bool isERC1155, address tokenContract, uint256 tokenId, uint256 quantity, uint96 expiry, address currency, uint256 pricePerToken)[]) external nonReentrant returns (uint256 requestId)"
    ]);

    const wallet = sequence.getWallet();
    const signer = wallet.getSigner('sepolia');
    
    // Function to split requests into chunks of 20
    const chunkSize = 20;
    const requestChunks = [];
    for (let i = 0; i < requests.length; i += chunkSize) {
        requestChunks.push(requests.slice(i, i + chunkSize));
    }

    // Process each chunk
    for (const requestChunk of requestChunks) {
        console.log(requestChunk)
        const dataCreateRequest = sequenceMarketInterface.encodeFunctionData(
            "createRequestBatch",
            [requestChunk]
        );

        const txn = {
            to: marketplaceContractAddress,
            data: dataCreateRequest
        };

        try {
            const res = await signer.sendTransaction(txn);
            console.log(res);

            // Get transaction hash
            const receipt = await provider.getTransactionReceipt(res.hash);

            // Get gas
            const totalCostInWei = receipt.gasUsed;
            console.log(`Tx Hash: ${res.hash}`);
            console.log(`Total cost: ${totalCostInWei}`);
        } catch (error) {
            console.error(`Error processing transaction: ${error}`);
        }
    }
};


  return (
    <div className="App">
      <br/>
      <br/>
      <h1>sequence market protocol <br/>batch wallet requests</h1>
      <br/>
      {isLoggedIn ? (
        <div className='container'>
          <br/>
          <input type="file" accept=".csv" onChange={handleFileUpload} />
          <br/>
          <br/>
          <Button label="create request batch" onClick={() => clickCreateRequest()} />
        </div>
      ) : (
        <>
          <br/>
          <br/>
          <Button label='connect' onClick={() => connect()} />
        </>
      )}
      <br/>
    </div>
  );
}

export default App;
