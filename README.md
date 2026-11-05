# 誘界カメラ

ホラーゲーム「誘界」の記念写真をつくる、スマホ向けのカメラです。

- 撮影、写真の読み込み、ドラッグ・拡大・左右反転
- 行方不明ポスター / 校内スナップの2フレーム
- 印刷 / 退色 / 異変の3加工と強さ調整
- 誘界ちゃん（仮）の表示切替、左右位置・サイズ調整
- 日付の表示切替と編集（初期値は端末の今日の日付）
- 校内スナップの背景は、ゲーム内の北廊下 / 201教室
- PNG保存、対応端末ではファイル共有

写真・映像はブラウザ内だけで処理し、サーバーへ送信しません。外部API・CDN・解析・外部フォント・永続保存は使いません。画像の縦横比を保って切り抜き、枠を空けない範囲で移動できます。キャラクターや日付は写真と一緒にPNGへ描き込みます。

## ローカル

Node.jsがあれば、インストールなしで実行できます。

```sh
node server.mjs
```

`http://127.0.0.1:4175` を開きます。カメラはHTTPSまたはlocalhost / 127.0.0.1で利用できます。`file://`での直接表示ではなくHTTPサーバーを使ってください。

```sh
node --check app.js
node --check server.mjs
```

## GitHub Pages

ビルド不要の静的サイトです。すべてのアセットは相対パスで参照し、リポジトリのサブパスに対応します。

`.github/workflows/pages.yml` は `main` へのpushで構文チェック後に公開用ファイルだけをPagesへ配置します。Settings → Pages → Build and deployment のSourceを **GitHub Actions** に設定します。

## 素材

- `assets/missing-poster.png`：ユーザー提供のポスター。
- `assets/school-corridor.jpg`、`school-classroom.jpg`：既存の「誘界」Unityプロジェクトの校舎描画。
- `assets/yukai-chan.png`：既存の通常形態モデル `AIWaxGirl_Normal.blend` を、透明背景で再描画。モデル・衣装・テクスチャは維持。
- キャラクターの再描画は `tools/render-character.py` に元のBlenderファイルを指定。Blenderファイルそのものは本リポジトリに含めません。

```sh
blender --background --python tools/render-character.py -- /path/to/AIWaxGirl_Normal.blend
```

カメラを閉じる、別タブへ移る、ページを離れると映像の取得を停止します。HEICの読み込みと共有方法はブラウザに依存します。iOSでダウンロードできない場合は、保存後のリンクから画像を開き、長押しで保存できます。
