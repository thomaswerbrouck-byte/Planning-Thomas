class GanttSocket {
  constructor() {
    this.socket     = null;
    this.pseudo     = '';
    this.projectId  = '';
    this.handlers   = {};
  }

  connect(pseudo, projectId) {
    this.pseudo    = pseudo;
    this.projectId = projectId;
    this.socket    = io();

    this.socket.on('connect', () => {
      this.socket.emit('join', { pseudo, projectId });
      this.socket.join?.(projectId);
    });

    ['users','user_joined','user_left','full_update'].forEach(ev =>
      this.socket.on(ev, d => this._emit(ev, d))
    );
    /* écoute la room spécifique */
    this.socket.on('users_' + projectId, d => this._emit('users', d));
  }

  switchProject(projectId) {
    this.projectId = projectId;
    this.socket?.emit('join_room', projectId);
    this.socket?.on('users_' + projectId, d => this._emit('users', d));
  }

  on(event, fn)     { this.handlers[event] = fn; }
  _emit(event, data){ this.handlers[event]?.(data); }

  sendFullUpdate(data) { this.socket?.emit('full_update', { data, by: this.pseudo }); }
}

window.ganttSocket = new GanttSocket();
