import * as React from 'react';
import FontIcon from 'material-ui/FontIcon';
import IconButton from 'material-ui/IconButton';
import { white, red500 } from 'material-ui/styles/colors';
import CircularProgress from 'material-ui/CircularProgress';
import SyncEngine from '../SyncEngine';

interface BoardStatusIconProps {
    pubSubClient: any;
    boardId: string;
}

interface BoardStatusIconState {
    hasConnectionFeedback: boolean;
    isConnected: boolean;
    heartbeats: Heartbeat[];
}

interface Heartbeat {
    clientId: string;
    timestamp: number;
}

interface HeartbeatMessage {
    clientId: string;
}

export default class BoardStatusIcon extends React.Component<BoardStatusIconProps, BoardStatusIconState> {

    private heartbeatSubscription: any;

    constructor(props: BoardStatusIconProps) {
        super(props);

        this.state = {
            hasConnectionFeedback: false,
            isConnected: false,
            heartbeats: [],
        };

        props.pubSubClient.on('transport:up', () => {
            this.setState({ hasConnectionFeedback: true, isConnected: true });
        });

        props.pubSubClient.on('transport:down', () => {
            this.setState({ hasConnectionFeedback: true, isConnected: false });
        });
    }

    public componentDidMount() {
        this.heartbeatSubscription = this.props.pubSubClient.subscribe(
            `/${this.props.boardId}/heartbeat`,
            this.handleHeartbeat.bind(this)
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
                this.handleHeartbeat.bind(this));
        }
    }

    public render() {
        let symbol = <CircularProgress size={20} color={white} thickness={3} />;
        let tooltip = 'Connecting to server';

        if (this.state.hasConnectionFeedback) {
            if (this.state.isConnected) {
                if (this.state.heartbeats.length <= 1) {
                    tooltip = 'Waiting for other users to join this board';
                } else {
                    symbol = <FontIcon className="material-icons" color={white}>people</FontIcon>;
                    tooltip = `${this.state.heartbeats.length} users on this board`;
                }
            } else {
                symbol = <FontIcon className="material-icons" color={red500}>error</FontIcon>;
                tooltip = 'No connection to server';
            }
        }

        return (
            <div>
                <IconButton
                    disableTouchRipple={true}
                    tooltip={tooltip}
                    tooltipPosition="bottom-center"
                >
                    {symbol}
                </IconButton>
            </div>
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

        this.setState({
            hasConnectionFeedback: true,
            isConnected: true,
            heartbeats: heartbeats,
        });
    }
}
