## Streamはどのように制御しているのか?

https://github.com/nodejs/node/blob/master/lib/internal/streams/BufferList.js

writeされるとBufferlistにqueされる。
BufferlistはObjectCheinになっており、head->tailとその間が.nextでつながっている
処理速度の向上が目的でArray->BufferListに変更された 2016/06/15


https://github.com/nodejs/node/commit/686984696de00ce09ac1d56e997cf705ecb6377d

というわけでPriorityQueueをするためには別の工夫が必要


## Stream WritableのBuffer 構造

chainしてあるのでsortは難しそう


this._writableState.lastBufferdRequest

state.bufferdRequestCount
state.bufferdRequest : head
