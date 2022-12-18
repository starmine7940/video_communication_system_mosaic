const Peer = window.Peer;

(async function main() {
    const myVideo = document.getElementById('my-video');
    const myId = document.getElementById('my-id');
    const videosContainer = document.getElementById('videos-container');
    const myVideoContainer = document.getElementById('my-video-container');
    const displayedMyName = document.getElementById('displayed-my-name');
    const myEmotion = document.getElementById('my-emotion');
    const myEmotionBar = document.getElementById('my-emotion-bar');
    const myName = document.getElementById('my-name');
    const roomId = document.getElementById('room-id');
    const messages = document.getElementById('messages');
    const joinTrigger = document.getElementById('join-trigger');
    const leaveTrigger = document.getElementById('leave-trigger');
    let memberList = {};
    let room;

    const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
    });
    myVideo.srcObject = localStream;
    

    const peer = new Peer({
        key: SKYWAY_KEY,
        debug: 0,                               //max:3
    });

    peer.on('open', (id) => {
        myId.textContent = id;
        myVideoContainer.setAttribute('id', id);
    });

    joinTrigger.addEventListener('click', () => {
        room = peer.joinRoom(roomId.value, {    //元々はconst
            mode: 'mesh',
            stream: localStream,
        });

        room.on('open', () => {
            messages.textContent += '===You joined===\n';
            displayedMyName.textContent = myName.value;
            myEmotionBar.value = 2;
            myEmotion.textContent = change_emotion(myEmotionBar.value);
            mosaic(myVideo, myEmotionBar.value);
            room.send({'event': 'name', 'data': myName.value});
            room.send({'event': 'emotion', 'data': myEmotionBar.value});
        });

        room.on('peerJoin', peerId => {
            messages.textContent += '===' + String(peerId) + ' joined===\n';
            room.send({'event': 'name', 'data': myName.value});
            room.send({'event': 'emotion', 'data': myEmotionBar.value});
        });

        room.on('stream', async stream => {
            create_personal_video_container(stream);
        });

        room.on('data', ({ data, src }) => {
            const personalVideoContainer = document.getElementById(src);
            if(data.event == 'name'){
                if(personalVideoContainer != null){
                    const personalName = personalVideoContainer.querySelector('.name');
                    personalName.textContent = data.data;
                }
                memberList[src] = data.data;
            }else if(data.event == 'emotion'){
                mosaic(personalVideoContainer.querySelector('video'), data.data);
            }
            
        });

        room.on('peerLeave', peerId => {
            const personalVideoContainer = videosContainer.querySelector('#' + String(peerId));
            personalVideoContainer.parentNode.removeChild(personalVideoContainer);
            delete memberList.peerId;
            messages.textContent += '===' + String(peerId) + ' left===\n';
        });

        room.once('close', () => {
            const personalVideoContainers = videosContainer.children;
            Array.from(personalVideoContainers).forEach(personalVideoContainer => {
                if (personalVideoContainer.id != myId.textContent){
                    personalVideoContainer.parentNode.removeChild(personalVideoContainer);
                }
            });
            messages.textContent += '===You left ===\n';
        });

        leaveTrigger.addEventListener('click', () => {
            room.close();
        }, { once: true });
    });

    peer.on('error', console.error);

    function create_personal_video_container(stream){               // async消してみた
        const remoteVideo = document.createElement('video');
        remoteVideo.srcObject = stream;
        remoteVideo.playsInline = true;
        remoteVideo.setAttribute('data-peer-id', stream.peerId);
        // 枠オブジェクト
        const remoteVideoContainer = document.createElement('div');
        remoteVideoContainer.setAttribute('id', stream.peerId);
        remoteVideoContainer.classList.add('personal-video-container');
        remoteVideoContainer.classList.add('small-container');
        // 名前オブジェクト
        const remoteName = document.createElement('h1');
        if(stream.peerId in memberList){
            remoteName.textContent = memberList[stream.peerId];
        }else{
            remoteName.textContent = '（名前を入力してください）';      //仮の名前
            
        }
        remoteName.classList.add('name');
        // セット
        remoteVideoContainer.append(remoteVideo);
        remoteVideoContainer.append(remoteName);
        videosContainer.append(remoteVideoContainer);
        remoteVideo.play().catch(console.error);                    // await消してみた
    }

    function change_emotion(emotion){
        let emotion_text = '';
        switch(emotion){
            case 0:
                emotion_text = '離れたい';
                break
            case 1:
                emotion_text = 'どちらかといえば離れたい';
                break
            case 2:
                emotion_text = 'どちらともいえない';
                break
            case 3:
                emotion_text = 'どちらかといえば近づきたい';
                break
            case 4:
                emotion_text = '近づきたい';
                break
        }
        return emotion_text;
    }

    document.addEventListener('keydown', function (e) {
        let changed_flag = false;
        if(e.code == 'ArrowLeft' && myEmotionBar.value > 0){
            myEmotionBar.value -= 1;
            changed_flag = true;
        }else if(e.code == 'ArrowRight' && myEmotionBar.value < 4){
            myEmotionBar.value += 1;
            changed_flag = true;
        }
        if(changed_flag){
            myEmotion.textContent = change_emotion(myEmotionBar.value);
            try{
                room.send({'event': 'emotion', 'data': myEmotionBar.value});    //Joinボタンを押さないと送れない
                post_to_sheet(roomId.value, myName.value, myEmotionBar.value);
            }catch(error){
                // console.log(error);
            }
            mosaic(myVideo, myEmotionBar.value);
            changed_flag = false;
        }
        
    })

    function post_to_sheet(roomId, name, emotion){
        const postData = {
            'roomId': roomId,
            'name': name,
            'time': Date.now(),
            'emotion': emotion
        }
        const param = {
            'method': 'POST',
            'mode': 'no-cors',
            'Content-Type' : 'application/x-www-form-urlencoded',
            'body': JSON.stringify(postData)
        }
        fetch(SCRIPT_URL, param)
            .then((response) => {
                // console.log(response);
            })
            .catch((error) => {
                // console.log(error)
            });
    }

    function mosaic(video, emotion){
        video.style.filter = 'blur(' + (2 - emotion / 2) + 'px)'
    }
})();