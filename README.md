# TOUCH THE SUN

2つの原子核を熱し、核融合を画面と2台のtoio Core Cubeで同時に表現する、約40秒の1画面デモです。toioがなくても `DEMO MODE` で体験できます。

公開版: [https://touch-the-sun.vercel.app](https://touch-the-sun.vercel.app)

## 起動

```bash
npm install
npm run dev
```

表示されたURLをChromeまたはEdgeで開きます。実機接続にはHTTPSまたはlocalhostが必要です。

## toioを使う

1. `TOIO MODE` を選ぶ
2. `CONNECT TO TOIO` を押し、1台目を選ぶ
3. 同じボタンをもう一度押し、2台目を選ぶ
4. 写真の大きいシンプルマット（青い格子だけのマット）を横向きに置く
5. 2台をシンプルマット上へ置く。画面に2台の座標が表示されたら準備完了

```text
シンプルマット中央

Cube A  →          ＋          ←  Cube B
```

接続順に関係なく、現在のX座標から左側をCube A、右側をCube Bとして判定します。`HOLD TO HEAT` を7秒長押しし、100%になったら `FUSION` を押します。長押しを離すと温度を保ったまま停止します。

FUSION後はSimpleTileMatの実座標を読み、2台を中央線 `y=250` 上の開始位置、接近、反発、プラズマ旋回、磁場反転、再接近、融合、放出の各目標座標へ `moveTo()` で移動します。実機の通信遅延で命令が途切れても、到着するまで移動命令を再送します。座標を見失った場合は自動停止します。加熱から完了までの目安は約40秒です。

記号・アルファベットが並ぶマットは今回は使いません。Cube上面の白いパーツは付けたままで構いません。

## 緊急停止・再実行

画面右上の `STOP / RESET`、または `Esc` キーでモーター・LED・音・演出を停止して初期状態へ戻します。接続済みの2台は、そのまま再実行できます。

## 実機調整

`src/main.js` 冒頭の `CONFIG` と `MAT_TARGETS` に、加熱速度、各工程の移動速度、目標座標、到着判定の許容距離、タイムアウトをまとめています。最初は広いテーブル上で低速のまま確認してください。

## Vercelへデプロイ

このフォルダをGitHubへpushし、VercelでリポジトリをImportします。

- Root Directory: `apps/touch-the-sun`（このリポジトリ全体をpushする場合）
- Build Command: `npm run build`
- Output Directory: `dist`

`vercel.json` と相対アセット設定を含むため、そのままデプロイできます。Web Bluetoothは本番のHTTPS上で動作します。

## 使用SDK

- [p5.toio 0.5.0](https://tetunori.github.io/p5.toio/) — Web Bluetooth接続、モーター、LED、スピーカー制御
- p5.js 1.11.1 — p5.toioの実行依存

実機接続とマット定義は、指定された[p5.jsスケッチ `toio-digital-twin-demo`](https://editor.p5js.org/akichika/sketches/DrQ64DrhE)と同じ `P5tCube.connectNewP5tCube()`、`P5tId.SimpleTileMat` を使用します。実機APIは既存の `apps/toio-cute-dance` とp5.toio公式APIリファレンスでも確認済みです。

物理計算や衝突判定は行わず、SimpleTileMatの座標を使う安全寄りの決め打ちシーケンスにしています。
