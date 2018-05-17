import * as React from 'react';
import FontIcon from 'material-ui/FontIcon';
import IconButton from 'material-ui/IconButton';
import { white, red400 } from 'material-ui/styles/colors';
import SyncEngine from '../SyncEngine';

enum SyncState {
    NoServerConnection = 0,
    WaitingForRemotePeople,
    Syncing,
    Intialising,
}

interface BoardStatusIconProps {
    // tslint:disable-next-line:no-any
    pubSubClient: any;
    boardId: string;
    showErrorsOnly: boolean;
}

interface BoardStatusIconState {
    heartbeats: Heartbeat[];
    sync: SyncState;
}

interface Heartbeat {
    clientId: string;
    timestamp: number;
}

interface HeartbeatMessage {
    clientId: string;
}

export default class BoardStatusIcon extends React.Component<BoardStatusIconProps, BoardStatusIconState> {

    // tslint:disable-next-line:no-any
    private heartbeatSubscription: any;

    constructor(props: BoardStatusIconProps) {
        super(props);

        this.state = {
            heartbeats: [],
            sync: SyncState.Intialising,
        };

        this.handleHeartbeat = this.handleHeartbeat.bind(this);

        window.setTimeout(
            () => {
                if (this.state.sync === SyncState.Intialising) {
                    if (this.getUserCount() === 0) {
                        this.setState({ sync: SyncState.NoServerConnection });
                    } else if (this.getUserCount() === 1) {
                        this.setState({ sync: SyncState.WaitingForRemotePeople });
                    } else {
                        this.setState({ sync: SyncState.Syncing });
                    }
                }
            },
            SyncEngine.HEARTBEAT_DURATION * 2
        );

        props.pubSubClient.on('transport:up', () => {
            this.setState({
                sync: this.state.sync === SyncState.Intialising
                    ? SyncState.Intialising : SyncState.WaitingForRemotePeople,
            });
        });

        props.pubSubClient.on('transport:down', () => {
            this.setState({ sync: SyncState.NoServerConnection });
        });
    }

    public componentDidMount() {
        this.heartbeatSubscription = this.props.pubSubClient.subscribe(
            `/${this.props.boardId}/heartbeat`,
            this.handleHeartbeat
        );
    }

    public componentWillUnmount() {
        this.heartbeatSubscription.cancel();
    }

    public componentWillReceiveProps(nextProps: BoardStatusIconProps) {
        if (this.props.boardId !== nextProps.boardId) {
            this.heartbeatSubscription.cancel();
            this.heartbeatSubscription = nextProps.pubSubClient.subscribe(
                `/${nextProps.boardId}/heartbeat`,
                this.handleHeartbeat);
        }
    }

    public render() {
        let symbol = null;
        let tooltip = '';

        if (this.state.sync === SyncState.NoServerConnection) {
            symbol = <FontIcon className="material-icons" color={red400}>sync_problem</FontIcon>;
            tooltip = 'No connection to server';

        } else if (this.state.sync === SyncState.Intialising && !this.props.showErrorsOnly) {
            symbol = <FontIcon className="material-icons" color={red400}>sync_disabled</FontIcon>;
            tooltip = 'Waiting for people to join this board';

        } else if (this.state.sync === SyncState.WaitingForRemotePeople) {
            symbol = <FontIcon className="material-icons" color={red400}>sync_disabled</FontIcon>;
            tooltip = 'Waiting for people to join this board';

        } else if (this.state.sync === SyncState.Syncing && !this.props.showErrorsOnly) {
            symbol = <FontIcon className="material-icons" color={white}>sync</FontIcon>;
            tooltip = `Sync between ${this.getUserCount()} people is established`;
        }

        return (
            <div>
                <IconButton
                    disabled={symbol ? false : true}
                    disableTouchRipple={true}
                    tooltip={tooltip}
                    tooltipPosition="bottom-center"
                >
                    {symbol}
                </IconButton>
            </div >
        );
    }

    private handleHeartbeat(message: HeartbeatMessage): void {
        const timestamp = Date.now();
        const maxAge = SyncEngine.HEARTBEAT_DURATION + 2000;

        let heartbeats = this.state.heartbeats.filter(
            heartbeat => {
                return heartbeat.clientId !== message.clientId
                    && heartbeat.timestamp + maxAge > timestamp;
            });

        heartbeats.push({ clientId: message.clientId, timestamp: timestamp } as Heartbeat);

        let connection = this.state.sync;

        if (heartbeats.length > 1) {
            connection = SyncState.Syncing;
        } else if (this.state.sync === SyncState.Syncing) {
            connection = SyncState.WaitingForRemotePeople;
        }

        this.setState({
            heartbeats: heartbeats,
            sync: connection,
        });
    }

    private getUserCount(): number {
        return this.state.heartbeats.length;
    }
}
