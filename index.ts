import { Server } from 'nethernet';
import { Advertisement } from './advertisement';

const server = new Server();

console.log(`Nethernet server created. networkId=${server.networkId}`);

server.on('openConnection', (connection) => {
  console.log(`[openConnection] address=${connection.address}`);
})

server.on('closeConnection', (connectionId, reason) => {
  console.log(`[closeConnection] connectionId=${connectionId}, reason=${reason}`);
});

server.on('encapsulated', (data, connectionId) => {
  console.log(`[encapsulated] connectionId=${connectionId}, dataLength=${data.length}`);
});

const ad = Advertisement.create({
  version: 1,
  serverName: 'NetherNet Test Server',
  levelName: 'Test World',
  gameType: 1, // Creative
  playerCount: 0,
  maxPlayerCount: 10,
  editorWorld: false,
  hardcore: false,
  transportLayer: 2,
});

server.setAdvertisement(ad);

await server.listen();
