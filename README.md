## Stream on Nodejs

NodejsでStreampAPIを使って自作のストリームを作る場合の手引き。  
詳しいところは公式にあるけど、そもそも使い方が分かった状態でないとあんまり理解出来ない...  
っていうか、私がつまったので書くことにした。

### メリットとデメリット

もちろんなんでこんなのがいるのと言う話ですが。
nodejsないでの実装としてはNet,httpなどのモジュールが
データを処理するときに共通した方法で出来るように実装したのがv0.12で
詳しくはyo-chan氏の[Stream今昔物語](http://yosuke-furukawa.hatenablog.com/entry/2014/12/01/155303)を参照してください。

* メリット
  1. 大量のデータを省メモリに作業できる
  2. 必然的にcallbackでの構成になるため、大量処理中でもプロセスをロックしない。
  3. データの流れがわかりやすくなる
  3. データの入出力とデータ処理部分が分離され拡張しやすくなる

* デメリット
  1. コードは長くなる
  2. まじめに実装すると結構しんどい
  3. 理解出来るまでのコスト

個人的にはデータの流れが分かりやすくなると言うのが大きいです。
大量のデータを処理するのに始点と終点のノード=入力と出力(統計/RSSでも/botでも)を作って、間にはフィルター処理をするストリームを足す形でシステムが簡単に構築できる。

### 前提


もうみんなv0.12使ってるよね?

* nodejs v0.12.0以降
  + drainやcork()などの流れを制御する機能がv0.11後半以降から追加のため

その辺無しで良ければ一応v0.10.31での動作は確認しています。

### 実装の基本

Streamは5種類ありますが内使うのはだいたい3種類で足りると思うのでここでは3種類の解説します。

|stream type|だいたいの用途|
|:--|:--|
|Readable|ストリームの始点|
|Writable|ストリームの終点|
|Duplex|(よく知らない)|
|Transform|ストリームの加工|
|PassThrough|パススルー(実装するものでは無い)|

#### Readable

Readableとは読み出し可能な、非ストリームなデータからストリームのデータを読み出す始点です。  
以下が基本のパターン

```javascript
// 定義
function ReadableStream(){
  Stream.Readable.call(this);  
}
util.inherits(ReadableStream, Stream.Readable);

// 実装すべきメソッド
ReadableStream.prototype._read = function(){
  this.push(null);
}

// 使い方
var rs = new RadableStream();
rs.pipe(hogeStream);
```

実装する必要があるのは`_read()`メソッド。
これは一つ上のメソッド`read()`の中で呼び出されるようになっていて、
`read()`で`pause()`やら下流の状態やらを勘案して実際に読み出しても良いときに`_read()`が呼び出される。
そのためデータを渡すことだけを実装すれば良い。

実装時に使う必要のあるメソッドは1つ`this.push(chunk)`である。  
これは下流のストリームに渡すためのデータを渡すためで、そのあとはAPIがやってくれる。
送るべきデータが無くなったら最後にnullをpushする。`this.push(null)`
これで下流にもend eventが発行されてストリームが閉じる。

というわけで実例。指定カウントまでデータを出すストリーム。

```javascript
function LengthStream(length, option){
  option = option || {};
	Stream.Readable.call(this, option);
	this.length = isNum(length) ? length : 30; // 長さ
	this._index = 0; //カウンタ
}
util.inherits(LengthStream, Stream.Readable);

LengthStream.prototype._read = function(){
  // 呼び出される毎にindexに加算して、lengthを越えたらnullを書いて終了
	if(this._index > this.length) {
		return this.push(null);
	}
	this.push(this._index.toString()); // 基本的にstreamはbuffer/string指定のため
	this._index++;
}
module.exports = LengthStream;

// 補助メソッド
function isNum(v){
	if(typeof(v) === 'number') return true;
	return false;
}
```


#### Writable

Writableはストリームから何かに書き込む終点。
以下が基本パターン

```javascript
// 定義
function WritableStream){
	Stream.Writable.call(this);
}
util.inherits(WritableStream, Stream.Writable);

// 実装すべきメソッド
WritableStream.prototype._write = function(chunk, encode, cb){
	cb();
}
```
実装する必要があるのは`_write()`メソッド。
これもまた`write()`で流れの制御をした後に呼び出されるので書き込みのみを実装すれば良い。

実装時に使う必要があるのは3つめの引数として渡される`cb()`
書き込みが終わって`cb()`を呼ぶと次の`write()`が呼び出されるループになっている。
readと違ってwriteは上流がいるため`end()`が外から呼ばれ、上流から渡されたデータが
全て`write()`に渡されたらストリームが終了する。

ここではnodejs本家のfs.CreateWriteStreamにある実装を見てみる。
コメントはオリジナルでは無く私が追記したもの。

```javascript
WriteStream.prototype._write = function(data, encoding, cb) {
  if (!util.isBuffer(data))
    return this.emit('error', new Error('Invalid data'));

  // まだ書き込みがなければopenを実行してfileを開いて_writeを再実行する。
  if (!util.isNumber(this.fd))
    return this.once('open', function() {
      this._write(data, encoding, cb);
    });

  var self = this;
  fs.write(this.fd, data, 0, data.length, this.pos, function(er, bytes) {
    if (er) {
      self.destroy();
      return cb(er); //正常に終わらなかった場合
    }
    self.bytesWritten += bytes;
    cb(); // 書き込みが確定したら次のループへ
  });

  if (!util.isUndefined(this.pos))
    this.pos += data.length;
};

```

自身の状態を更新しながらデータを書き込む処理を繰り返すという構造が見て取れる。

#### Transform

おそらくここまで読んだのならだいたい想像が付くとおもうが、
ストリームをうけとり、ストリームで下流に渡すのがTransformだ。
実際にはDuplexと同じ構造だが、DuplexはStream以外に変換される場合に使うようだ。
nodejsのnet.jsあたりが参考になるはず。

とにかくTransformは以下が基本パターン

```javascript
// 定義
function Transform){
	Stream.Transform.call(this);
}
util.inherits(Transform, Stream.Transform);

// 実装すべきメソッド
Transform.prototype._transform = function(chunk, encode, cb){
	this.push(chunk)
	cb();
}
// 実装可能なメソッド
Transform.prototype._flush = function(cb){
	cb();
}
```

`_transform()`は見ての通りReadableとWritableの両方の使い方を併せ持ち
受け取ったデータを次に渡すか、処理が終わったかを`this.push()`と`cb()`でそれぞれ任意のタイミングで実行出来る。
ここで一つ違うのが`_flush()`の存在だ。
上流からend eventが発行されたときTransformが下流にendを送る前に最後に実行されるメソッドである。
なぜ必要かは以下の例を見て欲しい。

```javascript
var lineStream = function (option){
	option = option || {};
	Stream.Transform.call(this,option);
	this._cache = "";
}
util.inherits(lineStream, Stream.Transform);

lineStream.prototype._transform = function(chunk, enc ,cb){
  var self = this;
	chunk = iconv.decode(chunk, "shift_jis");
	chunk = this._cache + chunk;   // cacheと結合
	chunk = chunk.split(/\r\n/);
	this._cache = chunk.pop();     // 最後のデータはcacheに
  chunk.forEach(function (d) {
		self.push(d);
	});
	cb();
}

lineStream.prototype._flush = function (callback) {
	this.push(this._cache);
  callback();
}
```

上流から流れてきたテキストデータを改行毎のchunkに直すストリームの例。
実際にcsvやtxtのデータを読むときはこんな感じで実装すると思うが、
この上流がどういうchunkで送ってくるかというとだいたい65556byteのbufferのため
`chunk.split(lf)`後の最後のデータが一列分あるとは限らない。
そのためcacheにいちど置いて繋げてから`split()`する事になるが、この場合`_transform()`を実行すると必ずcacheにデータが残ってしまう。
そこで`_flush()`メソッド。全てのデータを渡しきった後に呼ばれるのでcacheしたデータを渡す事が出来る。

なおTransformの場合は勝手に`this.push(null)`が呼ばれるので呼ばなくても良い。

### 自作ストリームを作る

以上でだいたい理解出来たと思う。ではストリームにしたときデータを確認するのはどうするのよという話になると思う。
もちろんストリームで取るしかないので、ここではストリーム内のデータを確認するためのストリームを作る。
とくにmochaなどでテストするならそういうのが必要になる。

```javascript
//-----------------------------------------------------------------------
// 確認用の拡張Stream
// @param initStatus 初期化時に関数を実行するか、objectを渡す
// @param optionはストリームの初期オプション
// @param assertFunction はtransformが実行する関数
// @param callback stream終了時に実行するcallback
function AssertStream(initFunction, option, assertFunction, callback){
	var self = this;
	if(!isFunction(initFunction)){
		Object.keys(initFunction).forEach(function(d){
			self[d] = initFunction[d];
		})
	}

	option = option || {};
	Stream.Transform.call(this, option);
	this._asserts = assertFunction;

	this.on('finish', function(){
		callback(self);
	})

	if(isFunction(initFunction)){
		initFunction(this);
	}
}
util.inherits(AssertStream, Stream.Transform);

AssertStream.prototype._transform = function (chunk, state, cb) {
	this._asserts(this, chunk, state, cb)
}

module.exports = AssertStream;
```

あまりスマートでは無いがこんな感じ。  
transhform関数に`console`なり`assert`なりをはさむことでデータを覗くことが出来る。

使用例

```javascript
var as = new AssertStream({},{},
	function (stream, chunk, state, callback){
		console.log(chunk.toString())
		callback();
	},function (stream){
		done(); // mochaのコールバック
});
```

要するにこういう実装が[through2.js](https://github.com/rvagg/through2)である。
自作の利点としては内部で呼ばれているイベントをフラグにするなどの細かな点が使えることだろうか。

デバッグに使う上で注意すべき点は下流にstreamがあるかどうか。
もし無い場合に`stream.push()`を呼ぶとデータがたまって`pause()`が掛かる。

### その他使用に当たって

およそ以上で使い方の方針は予想が付いたのでは無いかと思う。
あとは[公式APIDocs](https://nodejs.org/api/stream.html)や[本家のソース](https://github.com/joyent/node/tree/master/lib)を参照されたし。

以下は気が付いたことのみmemo

* ストリームはBuffer/Stringしかだめなの?
  `option{objectMode: true}`で変更できる。
  バッファ周りが少し変わるので注意。

* バッファの大きさは?
  `option{highWaterMark: 16}`で変更できる

* drainとかpauseの動作はどう?
  このリポジトリのtest_cache.jsにテストコードを書いている

* ストリームのコストは?
  このリポジトリのtest_mesure.jsで実行出来る。
  郵便局の全国住所データから広島県のみを切り出す操作を行うコード。
  頻繁にpause()が掛からない限り気にしなくても良いだろうというのが2015/04/06での見解。
  重いのはむしろ実装した中身の方と、データサイズの変更で呼び出される回数そのものが増えることが計算コスト増大に繋がる。
  また通常だとStringは勝手にbufferにされるので気になるならObjectModeを常に使う方が良い。

以下、実行結果(環境:MBA 11-inch Mid2011)

|type|latest memory(rss)|timeavg|stream call count|pickup result|
|:---|:---|:---|:---|:---|
|全文memory上で処理|291MB|349ms|1|2160|
|CreateStreamから直で処理+PassThorugh*10|65MB|285ms|187|2160|
|CreateStreamから直で処理+PassThorugh*100|69MB|316ms|187|2160|
|LFでchunk分割後に処理|66MB|394ms|123793|2160|


memory上で処理しているのが遅いのはメモリに余裕がないためかもしれない。
もっと余裕のあるLinux環境(HDD)で行った場合はonmemoryが一番早かった。
passthroughは+90個繋げても30msの遅延程度
データをLFで切るとstreamを呼び出す回数が600倍になっているのが109msも伸びた主因と思われる。
