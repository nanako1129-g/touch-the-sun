# TOUCH THE SUN

2つの原子核を熱し、核融合を画面と2台のtoio Core Cubeで同時に表現する、約45秒の1画面デモです。toioがなくても `DEMO MODE` で体験できます。

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
4. A4開発用プレイマット1枚、またはA3簡易プレイマットを平らに置く
5. A4の場合は縦向きにし、toioロゴが手前になる向きで、同じ面に2台を置く
6. 画面に2台の座標とマット判定が表示されたら準備完了

```text
A4 / A3マット中央

Cube A  →          ＋          ←  Cube B
```

接続順に関係なく、現在のX座標から左側をCube A、右側をCube Bとして判定します。A4開発用プレイマットは、表（Position ID `x=98〜250`）と裏（`x=250〜402`）を現在座標から自動判定し、それぞれの範囲に収まる小型軌道へ切り替えます。表裏を2枚つないだA3相当や、従来のA3簡易マットも自動判定します。

A4マットの座標は、[スイッチサイエンスの商品仕様](https://www.switch-science.com/products/8144)と[参考仕様PDF](https://doc.switch-science.com/media/files/2927c759-321f-45b3-ad6b-559fa988dba2.pdf)に基づいています。

`HOLD TO HEAT` を7秒長押しし、100%になったら `FUSION` を押します。長押しを離すと温度を保ったまま停止します。

FUSION後はSimpleTileMatの実座標を読み、2台を中央線 `y=250` 上の開始位置、接近、反発、プラズマ旋回、磁場反転、高速スピン、再接近、融合の各目標座標へ `moveTo()` で移動します。高速スピンは2台を離した安全位置で互いに逆回転させ、その後に座標を再ロックします。融合時は2台を中央で密着させ、互いに押し合いながら左右モーターを高速で切り替えて強く振動させます。モーター速度はp5.toioの有効上限 `115` 以内へ制限しています。実機の通信遅延で命令が途切れても、到着するまで移動命令を再送します。座標を見失った場合は自動停止します。

画面右上の `BGM ON / OFF` でBGMを切り替えられます。ブラウザの自動再生制限に対応するため、BGMは最初のボタン操作から再生を開始します。核融合時はBGMの音量を一時的に下げ、爆発音を聞きやすくします。

記号・アルファベットが並ぶマットは今回は使いません。Cube上面の白いパーツは付けたままで構いません。

## 緊急停止・再実行

画面右上の `STOP / RESET`、または `Esc` キーでモーター・LED・音・演出を停止して初期状態へ戻します。接続済みの2台は、そのまま再実行できます。

## 実機調整

`src/main.js` 冒頭の `CONFIG`、`A3_TARGETS`、`createA4Targets()` に、加熱・スピン・融合時の速度、各工程の目標座標、到着判定の許容距離、タイムアウトをまとめています。A4マットは平らな場所へ置き、周囲にも余裕を持たせ、最初はいつでも `Esc` を押せる状態で確認してください。

## Vercelへデプロイ

このフォルダをGitHubへpushし、VercelでリポジトリをImportします。

- Root Directory: `apps/touch-the-sun`（このリポジトリ全体をpushする場合）
- Build Command: `npm run build`
- Output Directory: `dist`

`vercel.json` と相対アセット設定を含むため、そのままデプロイできます。Web Bluetoothは本番のHTTPS上で動作します。

## 使用SDK

- [p5.toio 0.5.0](https://tetunori.github.io/p5.toio/) — Web Bluetooth接続、モーター、LED、スピーカー制御
- p5.js 1.11.1 — p5.toioの実行依存
- `public/audio/fusion-explosion.mp3` — 核融合時の爆発音（ユーザー提供素材）
- `public/audio/galaxy-runner.mp3` — 体験中のBGM（ユーザー提供素材）

実機接続とマット定義は、指定された[p5.jsスケッチ `toio-digital-twin-demo`](https://editor.p5js.org/akichika/sketches/DrQ64DrhE)と同じ `P5tCube.connectNewP5tCube()`、`P5tId.SimpleTileMat` を使用します。実機APIは既存の `apps/toio-cute-dance` とp5.toio公式APIリファレンスでも確認済みです。

物理計算や衝突判定は行わず、SimpleTileMatの座標を使う安全寄りの決め打ちシーケンスにしています。
