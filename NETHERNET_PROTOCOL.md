# NetherNet プロトコル仕様書

このドキュメントは `node-nethernet` の実装に基づいた NetherNet プロトコルの仕様概要です。
NetherNet は、ローカルネットワーク上のピア発見（Discovery）と、WebRTC を用いた信頼性の高いデータ通信を組み合わせたプロトコルです。

## 1. 概要

NetherNet の通信は大きく分けて 2 つのフェーズで構成されます。

1.  **Discovery & Signaling (UDP)**:
    *   UDP ブロードキャスト（ポート 7551）を使用してネットワーク内のピアを発見します。
    *   発見後、WebRTC の接続確立に必要な SDP (Session Description Protocol) や ICE Candidate の交換（シグナリング）もこの UDP 通信上で行われます。
    *   パケットは暗号化され、署名されています。

2.  **Data Transport (WebRTC)**:
    *   確立された WebRTC 接続上でデータ通信を行います。
    *   `node-datachannel` (libdatachannel) を使用しています。
    *   信頼性のあるチャネル (`ReliableDataChannel`) と信頼性のないチャネル (`UnreliableDataChannel`) が用意されます。

## 2. 接続シーケンス

```mermaid
sequenceDiagram
    participant Client
    participant Server

    Note over Client, Server: UDP Phase (Port 7551)
    Client->>Server: DiscoveryRequest (Broadcast)
    Server->>Client: DiscoveryResponse (Advertisement)
    
    Note over Client: WebRTC Offer 作成
    Client->>Server: DiscoveryMessage (CONNECTREQUEST + SDP Offer)
    
    Note over Server: WebRTC Answer 作成
    Server->>Client: DiscoveryMessage (CONNECTRESPONSE + SDP Answer)
    
    loop ICE Candidates
        Client->>Server: DiscoveryMessage (CANDIDATEADD)
        Server->>Client: DiscoveryMessage (CANDIDATEADD)
    end

    Note over Client, Server: WebRTC Connected
    Client->>Server: Data (ReliableDataChannel)
    Server->>Client: Data (ReliableDataChannel)
```

## 3. UDP パケット構造

UDP パケットは以下の構造でカプセル化されています。

### 3.1. 暗号化と署名

すべての UDP パケットは **AES-256-ECB** で暗号化され、**HMAC-SHA256** で署名されています。

*   **App ID**: `0xdeadbeef` (Little Endian 64-bit integer)
*   **AES Key**: `SHA-256(App ID)`
*   **Checksum**: `HMAC-SHA256(Encrypted Payload, AES Key)`

**パケットレイアウト:**
```
[ Checksum (32 bytes) ] + [ Encrypted Payload (N bytes) ]
```

**暗号化前のペイロード構造:**
```
[ Length (2 bytes) ] + [ Packet ID (2 bytes) ] + [ Sender ID (8 bytes) ] + [ Padding (8 bytes) ] + [ Data (Variable) ]
```
*   **Length**: `Packet ID` から `Data` 末尾までのバイト数（`Length` フィールド自体は含まない実装が多いが、`nethernet-spec` のコードでは `buf.Len()` を使用しており、これは `ID` 以降の長さ）。
*   **Padding**: 常に 8 バイトのゼロ埋め。

### 3.2. ペイロード構造 (復号後)

復号されたペイロードは `protodef` 形式で定義されており、以下の構造を持ちます。

| フィールド | 型 | 説明 |
| :--- | :--- | :--- |
| Length | lu16 | パケット全体の長さ |
| Type | lu16 | パケットタイプ ID |
| Body | Variable | パケットタイプごとのデータ |

### 3.3. パケットタイプ定義

`node-nethernet` の定義では `reserved` (8 bytes) が含まれていますが、`nethernet-spec` によるとこれは **8-byte padding** と定義されています。
すべてのディスカバリパケットにおいて、Sender ID の直後にこのパディングが存在します。

#### ID 0: DiscoveryRequest
クライアントがサーバーを探すためにブロードキャストします。

| フィールド | 型 | 説明 |
| :--- | :--- | :--- |
| sender_id | lu64 | 送信者のランダムなネットワーク ID |
| padding | buffer(8) | 8バイトのパディング (通常は 0) |

#### ID 1: DiscoveryResponse
サーバーが自身の存在を知らせるために応答します。

| フィールド | 型 | 説明 |
| :--- | :--- | :--- |
| sender_id | lu64 | サーバーのネットワーク ID |
| padding | buffer(8) | 8バイトのパディング |
| data | pstring (lu32 len, utf-8) | サーバーのアドバタイズメントデータ |

#### ID 2: DiscoveryMessage
特定のピア間でのシグナリングメッセージ（WebRTC のセットアップ）に使用されます。

| フィールド | 型 | 説明 |
| :--- | :--- | :--- |
| sender_id | lu64 | 送信者のネットワーク ID |
| padding | buffer(8) | 8バイトのパディング |
| recipient_id | lu64 | 受信者のネットワーク ID |
| data | pstring (lu32 len, utf-8) | シグナリングデータ文字列 |


### 3.4. Advertisement データについて

`DiscoveryResponse` パケットに含まれる `data` フィールド（Advertisement）は、サーバーに関する任意の情報をクライアントに伝えるために使用されます。

*   **プロトコル定義**: UTF-8 文字列 (`pstring`)
*   **実装の詳細**:
    *   `node-nethernet`: 任意のバイナリデータを **16進数文字列 (Hex String)** に変換して格納します。
    *   `go-nethernet`: 同様に、`ApplicationData` を Hex エンコードして送信しています (`packet_response.go` 参照)。
    *   したがって、このフィールドは実質的に「Hex エンコードされたバイナリデータ」を運ぶためのコンテナとして機能しています。

#### Minecraft (Bedrock) 互換のデータ構造

`go-nethernet` の実装に基づくと、Minecraft (Bedrock) 関連の実装では以下のバイナリ構造が使用されているようです。
このバイナリデータ全体が Hex 文字列に変換されて `DiscoveryResponse` の `data` に格納されます。

全ての数値は **Little Endian** です。

| フィールド | 型 | 説明 |
| :--- | :--- | :--- |
| Version | u8 | データバージョン |
| ServerName Length | u8 | サーバー名の長さ |
| ServerName | string | サーバー名 (UTF-8) |
| LevelName Length | u8 | ワールド名の長さ |
| LevelName | string | ワールド名 (UTF-8) |
| GameType | i32 | ゲームタイプ (0: Survival, 1: Creative, 2: Adventure, etc.) |
| PlayerCount | i32 | 現在のプレイヤー数 |
| MaxPlayerCount | i32 | 最大プレイヤー数 |
| EditorWorld | bool (u8) | エディターワールドかどうか |
| Hardcore | bool (u8) | ハードコアモードかどうか |
| TransportLayer | i32 | トランスポート層の種類 (通常は 0?) |

**構造体定義 (Go):**
```go
type ServerData struct {
    Version        uint8
    ServerName     string
    LevelName      string
    GameType       int32
    PlayerCount    int32
    MaxPlayerCount int32
    EditorWorld    bool
    Hardcore       bool
    TransportLayer int32
}
```

#### ID 2: DiscoveryMessage
特定のピア間でのシグナリングメッセージ（WebRTC のセットアップ）に使用されます。

| フィールド | 型 | 説明 |
| :--- | :--- | :--- |
| sender_id | lu64 | 送信者のネットワーク ID |
| reserved | buffer(8) | 予約領域 |
| recipient_id | lu64 | 受信者のネットワーク ID |
| data | pstring (lu32 len, utf-8) | シグナリングデータ文字列 |

## 4. シグナリングプロトコル

`DiscoveryMessage` の `data` フィールドには、スペース区切りのテキスト形式でシグナリング情報が格納されます。

**フォーマット:**
```
<SIGNAL_TYPE> <CONNECTION_ID> <DATA>
```

*   **SIGNAL_TYPE**: メッセージの種類
*   **CONNECTION_ID**: WebRTC 接続を一意に識別する ID (BigInt)
*   **DATA**: SDP 文字列や ICE Candidate 情報など（残りのすべての文字列）

**Signal Types:**
*   `CONNECTREQUEST`: クライアントからの接続要求 (SDP Offer を含む)
*   `CONNECTRESPONSE`: サーバーからの接続応答 (SDP Answer を含む)
*   `CANDIDATEADD`: ICE Candidate の追加情報
*   `CONNECTERROR`: 接続エラー通知

**WebRTC ロール:**
*   **Client**: ICE Controller (SDP Offer を送信, `setup:actpass`)
*   **Server**: ICE Agent (SDP Answer を送信, `setup:active`)

**SDP パラメータ (参考):**
*   `msid-semantic`: `WMS`
*   `sctp-port`: `5000`
*   Media: `application`, `webrtc-datachannel`

## 5. WebRTC データ転送

WebRTC 接続確立後、以下の DataChannel が作成されます。

*   **ReliableDataChannel**
    *   Label: `"ReliableDataChannel"`
    *   Ordered: `true` (デフォルト)
    *   用途: 重要なゲームパケットの送信
*   **UnreliableDataChannel**
    *   Label: `"UnreliableDataChannel"`
    *   Ordered: `false`
    *   用途: 位置情報など、損失してもよいデータの送信

### 5.1. フラグメンテーション (Reliable Channel)

`ReliableDataChannel` 上で送信されるデータは、最大メッセージサイズ（実装では 10,000 バイト）を超える場合、分割（フラグメンテーション）されます。

**フラグメント構造:**
```
[ Remaining Segments (1 byte) ] + [ Data Fragment ]
```

*   **Remaining Segments**: 残りのセグメント数（カウントダウン方式）。
    *   例: 3分割の場合 -> `2` (残り2つ), `1` (残り1つ), `0` (残りなし) となる。
    *   受信側は `0` を受け取るまでバッファを結合し続けます。
*   **Data Fragment**: 実際のペイロードの一部。
    *   結合後のデータは、通常 **Minecraft Bedrock Packet** (`Length (varuint32)` + `Payload`) となります。

**送信ロジック:**
1.  データを `MAX_MESSAGE_SIZE` (10,000) ごとに分割。
2.  各チャンクの先頭に「残りのセグメント数」を付与して送信。
3.  例: 3分割の場合 -> `[2][Data1]`, `[1][Data2]`, `[0][Data3]`

**受信ロジック:**
1.  先頭 1 バイトを読み取り、期待されるセグメント数と比較。
2.  データをバッファに結合。
3.  セグメント数が `0` になったら、結合された完全なデータを上位層（`encapsulated` イベント）に渡す。

## 6. Xbox Live シグナリング (参考)

LAN ディスカバリ以外に、Xbox Live のセッションディレクトリを使用した接続もサポートされています。
この場合、シグナリングは WebSocket 経由で行われます。

*   **WebSocket URL**: `wss://signal.franchise.minecraft-services.net/ws/v1.0/signaling/<XBL_SESSION_ID>`
*   **認証**: XBL トークン (MCToken) が必要

## 7. 参考文献

*   [df-mc/nethernet-spec](https://github.com/df-mc/nethernet-spec) - リバースエンジニアリングによる仕様書
*   [PrismarineJS/node-nethernet](https://github.com/PrismarineJS/node-nethernet) - Node.js 実装
