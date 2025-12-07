export interface AdvertisementData {
  version: number;
  serverName: string;
  levelName: string;
  gameType: number;
  playerCount: number;
  maxPlayerCount: number;
  editorWorld: boolean;
  hardcore: boolean;
  transportLayer: number;
}

export class Advertisement {
  static create(ad: AdvertisementData): Buffer {
    const buffers: Buffer[] = [];

    // Version (u8)
    const versionBuf = Buffer.alloc(1);
    versionBuf.writeUInt8(ad.version);
    buffers.push(versionBuf);

    // ServerName (u8 len + string)
    const serverNameBuf = Buffer.from(ad.serverName, 'utf8');
    const serverNameLenBuf = Buffer.alloc(1);
    serverNameLenBuf.writeUInt8(serverNameBuf.length);
    buffers.push(serverNameLenBuf);
    buffers.push(serverNameBuf);

    // LevelName (u8 len + string)
    const levelNameBuf = Buffer.from(ad.levelName, 'utf8');
    const levelNameLenBuf = Buffer.alloc(1);
    levelNameLenBuf.writeUInt8(levelNameBuf.length);
    buffers.push(levelNameLenBuf);
    buffers.push(levelNameBuf);

    // GameType (i32)
    const gameTypeBuf = Buffer.alloc(4);
    gameTypeBuf.writeInt32LE(ad.gameType);
    buffers.push(gameTypeBuf);

    // PlayerCount (i32)
    const playerCountBuf = Buffer.alloc(4);
    playerCountBuf.writeInt32LE(ad.playerCount);
    buffers.push(playerCountBuf);

    // MaxPlayerCount (i32)
    const maxPlayerCountBuf = Buffer.alloc(4);
    maxPlayerCountBuf.writeInt32LE(ad.maxPlayerCount);
    buffers.push(maxPlayerCountBuf);

    // EditorWorld (bool -> u8)
    const editorWorldBuf = Buffer.alloc(1);
    editorWorldBuf.writeUInt8(ad.editorWorld ? 1 : 0);
    buffers.push(editorWorldBuf);

    // Hardcore (bool -> u8)
    const hardcoreBuf = Buffer.alloc(1);
    hardcoreBuf.writeUInt8(ad.hardcore ? 1 : 0);
    buffers.push(hardcoreBuf);

    // TransportLayer (i32)
    const transportLayerBuf = Buffer.alloc(4);
    transportLayerBuf.writeInt32LE(ad.transportLayer);
    buffers.push(transportLayerBuf);

    return Buffer.concat(buffers);
  }
}
