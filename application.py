import os

from flask import Flask, render_template, request, redirect, url_for
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_sqlalchemy import SQLAlchemy
import collections
from collections import deque

file_path = os.path.abspath(os.getcwd())+"/todo.db"

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
app.config['DEBUG'] = True

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = True
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///'+file_path
db = SQLAlchemy(app)

# TODO LIST DB


class Todo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(200))
    complete = db.Column(db.Boolean, default=False)

    def __repr__(self):
        return self.text


db.drop_all()
db.create_all()


socketio = SocketIO(app)

# Dict with channel names and lists to archive messages
messagesArchive = {
    "General": deque([], maxlen=100)
}


@app.route("/")
def index():

    songs = os.listdir('static/music')
    incomplete = Todo.query.filter_by(complete=False).all()
    for i in incomplete:
        print(i.text)
    complete = Todo.query.filter_by(complete=True).all()
    return render_template("index.html", incomplete=incomplete, complete=complete,songs=songs)


@socketio.on("connect")
def test_connect():
    print(request.sid)


@socketio.on("disconnect")
def test_connect():
    print("DISCONNECTED!")

# For returning current channels


@socketio.on("available channels")
def availableChannel():
    # Get keys from messagesArchive dict as a list
    channelList = list(messagesArchive)
    emit("receive channels", channelList)

# For adding a new channel to List


@socketio.on("submit channel")
def channel(data):
    channel = data.get('channelName')
    # Checks if submitted channel exists as a key in dict
    if channel in messagesArchive.keys():
        # Channel exists
        emit('alert message', {
             'message': "Channel already exists"}, room=request.sid)
        return False
    # Creates a new key and initializes with a deque with max length 100, if key already exists, do nothing
    # Saw on https://docs.quantifiedcode.com/python-anti-patterns/correctness/not_using_setdefault_to_initialize_a_dictionary.html
    messagesArchive.setdefault(channel, deque([], maxlen=100))
    # Get keys from dict as a list
    channelList = list(messagesArchive)
    emit("receive channels", channelList, broadcast=True)
    #emit("return message", channel)


# For joining a channel
@socketio.on("join channel")
def joinChannel(data):
    currentChannel = data.get('currentChannel')
    selectedChannel = data.get('selectedChannel')
    if selectedChannel == 'empty':
        # joining a channel for the first time
        join_room(currentChannel)
        try:
            if messagesArchive[currentChannel]:
                messages = list(messagesArchive[currentChannel])
                emit('receive previous messages', messages)
        except KeyError:
            emit('alert message', {
                 'message': "Saved channel does not exist, please log off"}, room=request.sid)

        emit('alert join', {'message': 'has joined the room ' + currentChannel, 'currentChannel': currentChannel,
                            'currentTime': data.get('currentTime'), 'user': data.get('user')}, room=currentChannel)
    else:
        # switching channels
        leave_room(currentChannel)
        emit('alert join', {'message': 'has left the room ' + currentChannel, 'currentChannel': selectedChannel,
                            'currentTime': data.get('currentTime'), 'user': data.get('user')}, room=currentChannel)
        join_room(selectedChannel)
        # checks if selected deque is not empty
        if messagesArchive[selectedChannel]:
            messages = list(messagesArchive[selectedChannel])
            emit('receive previous messages', messages)
        emit('alert join', {'message': 'has joined the room ' + selectedChannel, 'currentChannel': selectedChannel,
                            'currentTime': data.get('currentTime'), 'user': data.get('user')}, room=selectedChannel)

# For receiving messages from clients


@socketio.on("receive message")
def message(data):
    room = data.get('currentChannel')
    message = data.get('messageField')
    time = data.get('currentTime')
    user = data.get('user')
    messagesArchive[room].append([message, room, time, user])
    emit("return message", {'messageField': message,
                            'currentChannel': room, 'currentTime': time, 'user': user}, room=room)


@socketio.on("previous messages")
def previousMessages(data):
    channel = data.get('currentChannel')
    if message in messagesArchive[channel]:
        emit("receive previous messages", messagesArchive)


@app.route('/add', methods=['POST'])
def add():
    todo = Todo(text=request.form['todoitem'])
    print(request.form['todoitem'])
    db.session.add(todo)
    db.session.commit()
    return redirect(url_for('index'))


@app.route('/complete/<id>')
def complete(id):

    todo = Todo.query.filter_by(id=int(id)).first()
    todo.complete = True
    db.session.commit()

    return redirect(url_for('index'))


# Must add line below because of SocketIO bug: https://github.com/miguelgrinberg/Flask-SocketIO/issues/817
# Instead of "flask run", application can be run using "python3 application.py"
if __name__ == "__main__":
    socketio.run(app)
