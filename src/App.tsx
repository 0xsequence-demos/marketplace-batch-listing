import './App.css';
import React, { useState } from 'react';
import { Button } from '@0xsequence/design-system';
import { ethers } from 'ethers'
import { sequence } from '0xsequence';
// @ts-ignore
import Papa from 'papaparse';

const chain = 'sepolia';
const marketplaceContractAddress = '0xB537a160472183f2150d42EB1c3DD6684A55f74c';
const collectionAddress = '0xabea5f754f6119853b5c252bcd25d5a313d14b64';
const currencyAddress = '0x25f69ff8bf4fe6b94724df84a6049de28bd46b65';

sequence.initWallet(process.env.REACT_APP_PROJECT_ACCESS_KEY!, { defaultNetwork: chain });

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
            isListing: true,
            isERC1155: true,
            tokenContract: collectionAddress,
            tokenId: parseInt(row.tokenId, 10),
            quantity: parseInt(row.quantity, 10),
            expiry: Date.now() + 60 * 60 * 24 * 30,
            currency: currencyAddress,
            pricePerToken: ethers.parseUnits(String(row.price), 18),
          }
        ));
          console.log(formattedRequests)
          setRequests(formattedRequests);
        },
      });
    }
  };

    const approveMarketplaceContract = async () => {
        const erc1155Interface = new ethers.Interface([
            "function setApprovalForAll(address _operator, bool _approved) returns ()",
        ]);

        const dataApprove = erc1155Interface.encodeFunctionData(
            'setApprovalForAll',
            [marketplaceContractAddress, true]
        );

        const txn = {
            to: collectionAddress,
            data: dataApprove
        };

        try {
            const signer = await getSigner();
            await signer.sendTransaction(txn);
        } catch (e) {
            console.log(e);
        }
    }

    const getSigner = async() => {
        const wallet = sequence.getWallet();
        return wallet.getSigner(chain);
    }

    const getProvider = () => {
        return new ethers.JsonRpcProvider(`https://nodes.sequence.app/${chain}/${process.env.REACT_APP_PROJECT_ACCESS_KEY}`);
    }

  const clickCreateRequest = async () => {
    if (requests.length === 0) {
        console.log("No requests to process. Please upload a CSV file.");
        return;
    }

    const sequenceMarketInterface = new ethers.Interface([
        "function createRequestBatch(tuple(bool isListing, bool isERC1155, address tokenContract, uint256 tokenId, uint256 quantity, uint96 expiry, address currency, uint256 pricePerToken)[]) returns (uint256 requestId)"
    ]);

      const signer = await getSigner();
    
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
            await getProvider().getTransactionReceipt(res.hash);
        } catch (error) {
            console.error(`Error processing transaction: ${error}`);
        }
    }
};


  return (
    <div className="App">
      <br/>
      <br/>
      <h1>Sequence Marketplace Batch Requests</h1>
      <br/>
      {isLoggedIn ? (
        <div className='container' style={{display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center'}}>
          <br/>
          <input type="file" accept=".csv" onChange={handleFileUpload} style={{backgroundColor: 'var(--seq-colors-button-glass)', padding: 10, borderRadius: 50}}/>
          <br/>
          <br/>
          <Button label="Approve Marketplace" onClick={() => approveMarketplaceContract()} />
          <Button label="Create Requests" onClick={() => clickCreateRequest()} />
        </div>
      ) : (
        <>
          <br/>
          <br/>
          <Button label='Connect' onClick={() => connect()} />
        </>
      )}
      <br/>
    </div>
  );
}

export default App;
