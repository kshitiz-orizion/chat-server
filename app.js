var express=require('express');
var app=express();
var server=require('http').createServer(app);
var io=require('socket.io').listen(server);
var mongoose=require('mongoose');
var users={};
mongoose.Promise=require('bluebird');

server.listen(4000);

mongoose.connect('mongodb://localhost/chat',function(err){
	if(err){
		console.log(err);

	}else{
		console.log('connected to mongodb');
	}

});

var chatSchema=mongoose.Schema({
	nick:  String,
	msg: String,
	created: {type: Date, default: Date.now}
});

var Chat= mongoose.model('Message',chatSchema);

app.get('/',function(req,res){
	res.sendFile(__dirname+'/index.html')
});

io.sockets.on('connection',function(socket){


	var channel='channel-a';
	socket.join(channel);
	console.log(socket.room,socket.rooms,socket.channel,socket.channels);

	var query=Chat.find({});

	query.sort('-created').limit(8).exec(function(err,docs){
		if(err) throw err;
		console.log('Sending old messages');	
		socket.emit('load old msgs',docs);
	});
	
	socket.on('change channel',function(newChannel){
		socket.leave(channel);
		channel=newChannel;
		socket.join(channel);
		socket.emit('change channel',channel);

	});

	socket.on('new user',function(data,callback){
		if(data in users){
			callback(false);
		}
		else{
			callback(true);
			socket.nickname= data;
			users[socket.nickname]=socket;
			updateNicknames();
		}
	});

	function updateNicknames(){
		io.sockets.emit('usernames',Object.keys(users));
	}
	socket.on('send message',function(data, callback){

		
		var msg=data.trim();
		if(msg.substr(0,3)  === '/w '){
			msg=msg.substr(3);
			var ind = msg.indexOf(' ');
			if(ind!== -1){
				var name=msg.substring(0,ind);
				var msg=msg.substring(ind+1);
				if(name in users){
					users[name].emit('whisper',{msg:msg,nick:socket.nickname});
					console.log('whisper');
				}else{
					callback('Error ! enter  valid user');
				}

			}else{
				callback('Error: Enter message for whisper');
			}
		}else{
			var newMsg = new Chat ({msg:msg, nick:socket.nickname});

			newMsg.save(function(err){
				if(err) throw err;
				console.log(channel,msg);
				io.sockets.in(channel).emit('new message',{'msg':msg,'nick':socket.nickname});
				//socket.broadcast.to(channel).emit('new message',{msg:msg,nick:socket.nickname});
			});
		}
	});

	socket.on('disconnect',function(data){
		if(!socket.nickname) return;
		delete users[socket.nickname];
		
		updateNicknames();
		
	});
	
});
