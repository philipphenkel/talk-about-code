import * as React from 'react';
import './App.css';
import MonacoEditor from 'react-monaco-editor';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import { MuiTheme } from 'material-ui/styles';
import getMuiTheme from 'material-ui/styles/getMuiTheme';
import FontIcon from 'material-ui/FontIcon';
import IconButton from 'material-ui/IconButton';
import { white, blueGrey700 } from 'material-ui/styles/colors';
import DropDownMenu from 'material-ui/DropDownMenu';
import MenuItem from 'material-ui/MenuItem';
import { Toolbar, ToolbarGroup, ToolbarTitle } from 'material-ui/Toolbar';
import ShareDialog from './components/ShareDialog';
import SaveDialog from './components/SaveDialog';
import BoardStatusIcon from './components/BoardStatusIcon';
import SyncEngine from './SyncEngine';
import { Utils } from './Utils';
import * as Clipboard from 'clipboard';
import { History } from 'history';
import createBrowserHistory from 'history/createBrowserHistory';
import { Config } from './Config';

const faye = require('faye');
const fayeClient = new faye.Client(Config.FAYE_URL);

enum Role {
  User = 'user',
  Admin = 'admin',
}

interface AppState {
  languages: string[];
  selectedLanguage: string;
  isShareDialogOpen: boolean;
  isSaveDialogOpen: boolean;
  boardId: string;
  role: Role;
  clientId: string;
}

interface AppProps {
}

interface BoardConfig {
  role: Role;
  language: string;
  content: string;
}

export default class App extends React.Component<AppProps, AppState> {

  private editor: monaco.editor.ICodeEditor;
  private muiTheme: MuiTheme;
  private syncEngine: SyncEngine;
  private attendeeLinkClipBoard: Clipboard;
  private adminLinkClipBoard: Clipboard;
  private pathUpdateTimer: number;
  private history: History;

  constructor(props: AppProps) {
    super(props);

    this.onResize = this.onResize.bind(this);
    this.onSelectLanguage = this.onSelectLanguage.bind(this);
    this.editorDidMount = this.editorDidMount.bind(this);
    this.refreshAdminPath = this.refreshAdminPath.bind(this);
    this.copyAdminLinkToClipboard = this.copyAdminLinkToClipboard.bind(this);
    this.copyUserLinkToClipboard = this.copyUserLinkToClipboard.bind(this);
    this.onSave = this.onSave.bind(this);
    this.onCloseShareDialog = this.onCloseShareDialog.bind(this);
    this.onCloseSaveDialog = this.onCloseSaveDialog.bind(this);
    this.onEditorChange = this.onEditorChange.bind(this);
    this.handleLanguageUpdate = this.handleLanguageUpdate.bind(this);

    this.state = {
      languages: [Config.DEFAULT_LANGUAGE],
      selectedLanguage: Config.DEFAULT_LANGUAGE,
      isShareDialogOpen: false,
      isSaveDialogOpen: false,
      boardId: '',
      role: Role.User,
      clientId: Utils.uuidv4(),
    };

    this.muiTheme = getMuiTheme({
      palette: {
        primary1Color: blueGrey700,
      },
      toolbar: {
        height: 65,
        backgroundColor: blueGrey700,
      }
    });
  }

  componentDidMount() {
    window.addEventListener('resize', this.onResize);
    this.attendeeLinkClipBoard = new Clipboard('.shareButton', { text: this.copyUserLinkToClipboard });
    this.adminLinkClipBoard = new Clipboard('.snapshotButton', { text: this.copyAdminLinkToClipboard });
    this.history = createBrowserHistory();
  }

  componentWillUnmount() {
    if (this.syncEngine) {
      this.syncEngine.stop();
    }
    this.adminLinkClipBoard.destroy();
    this.attendeeLinkClipBoard.destroy();
    window.removeEventListener('resize', this.onResize);
  }

  componentDidUpdate(prevProps: AppProps, prevState: AppState) {
    if (this.state.role === Role.Admin) {
      this.refreshAdminPath();
    }
  }

  onResize() {
    if (this.editor) {
      this.editor.layout();
    }
  }

  onSelectLanguage(event: React.SyntheticEvent<{}>, index: number, value: string) {
    fayeClient.publish(`/${this.state.boardId}/language`, value);
  }

  handleLanguageUpdate(language: string) {
    this.setState({ selectedLanguage: language });
  }

  editorDidMount(editor: monaco.editor.ICodeEditor) {
    this.editor = editor;
    this.editor.focus();

    // Parse URL <host>/board/<boardId>/<boardConfigurationBase64>
    const loc = this.history.location;
    const pathArray = loc.pathname.split('/');
    let boardId = '';
    let boardContent = '';
    let role = Role.Admin;
    let language = Config.DEFAULT_LANGUAGE;

    if (pathArray.length >= 3 && pathArray[1] === 'board' && pathArray[2]) {
      // Connect to existing board as user
      boardId = pathArray[2];
      role = Role.User;

      // Apply board config
      if (pathArray.length >= 4) {
        const encodedHashValue = pathArray[3];
        try {
          const boardConfig = JSON.parse(Utils.atou(encodedHashValue));
          boardContent = boardConfig.content;
          role = boardConfig.role;
          language = boardConfig.language;
        } catch (err) {
          // ignore decoding errors and sync content from others
        }
      }
    } else {
      // Create new board
      role = Role.Admin;
      boardId = Utils.uuidv4();
    }

    this.syncEngine = new SyncEngine(editor, fayeClient, boardId, boardContent);
    this.syncEngine.start();

    fayeClient.subscribe(`/${boardId}/language`, this.handleLanguageUpdate);

    const languages = monaco.languages
      .getLanguages()
      .map(function (lang: monaco.languages.ILanguageExtensionPoint) { return lang.id; });

    this.setState({
      selectedLanguage: language,
      languages: languages,
      boardId: boardId,
      role: role
    });
  }

  getAdminPath() {
    const boardConfig: BoardConfig = {
      role: Role.Admin,
      language: this.editor.getModel().getModeId(),
      content: this.editor.getValue()
    };

    const configJSON = JSON.stringify(boardConfig);

    return `/board/${this.state.boardId}/${Utils.utoa(configJSON)}`;
  }

  refreshAdminPath() {
    const path = this.getAdminPath();
    this.history.replace(path);
  }

  copyAdminLinkToClipboard(elem: Element): string {
    this.setState({ isSaveDialogOpen: true });

    if (this.editor) {
      const path = this.getAdminPath();
      return `${window.location.protocol}//${window.location.host}${path}`;
    } else {
      return '';
    }
  }

  copyUserLinkToClipboard(elem: Element): string {
    this.setState({ isShareDialogOpen: true });
    return `${window.location.protocol}//${window.location.host}/board/${this.state.boardId}`;
  }

  onSave() {
    this.setState({ isSaveDialogOpen: true });
  }

  onCloseShareDialog() {
    this.setState({ isShareDialogOpen: false });
  }

  onCloseSaveDialog() {
    this.setState({ isSaveDialogOpen: false });
  }

  onEditorChange() {
    if (this.state.role === Role.Admin) {
      clearTimeout(this.pathUpdateTimer);
      this.pathUpdateTimer = window.setTimeout(
        this.refreshAdminPath,
        5000);
    }
  }

  render() {

    const options = {
      selectOnLineNumbers: true,
      minimap: { enabled: false },
      contextmenu: true,
      folding: false,
      theme: 'vs',
      automaticLayout: false,
      occurrencesHighlight: false,
      selectionHighlight: false,
      scrollBeyondLastLine: false,
      fontFamily: 'Source Code Pro',
      fontSize: 14,
      quickSuggestions: false,
      parameterHints: false,
    };

    const styles = {
      title: {
        fontFamily: 'Permanent Marker',
        color: 'white',
        fontSize: 30
      },
      labelStyle: {
        color: 'white'
      },
      dropDownMenu: {
        width: 200,
        height: 56,
        textAlign: 'right',
      },
    };

    const languageItems = this.state.languages.map((language: string) => (
      <MenuItem value={language} key={language} primaryText={language.toUpperCase()} />
    ));

    const renderAdminControls = () => {
      if (this.state.role === Role.Admin) {
        return (
          <ToolbarGroup>

            <IconButton tooltip={'Create attendee link'} className="shareButton">
              <FontIcon className="material-icons" color={white}>send</FontIcon>;
            </IconButton>

            <IconButton tooltip={'Create a new board'} containerElement={<a href="/" target="_blank" />}>
              <FontIcon className="material-icons" color={white}>add_circle_outline</FontIcon>;
            </IconButton>

            <IconButton tooltip={'Create administrator link'} className="snapshotButton">
              <FontIcon className="material-icons" color={white}>save_alt</FontIcon>;
            </IconButton>

            <DropDownMenu
              value={this.state.selectedLanguage}
              labelStyle={styles.labelStyle}
              onChange={this.onSelectLanguage}
              style={styles.dropDownMenu}
            >
              {languageItems}
            </DropDownMenu>

          </ToolbarGroup>
        );
      } else {
        return '';
      }
    };

    const spacerStyle = {
      paddingRight: 30,
    };

    const requireConfig = {
      url: `${Config.MONACO_EDITOR_PATH}/loader.js`,
      paths: {
        'vs': Config.MONACO_EDITOR_PATH
      },
    };

    return (
      <MuiThemeProvider muiTheme={this.muiTheme}>
        <div className="App">
          <ShareDialog open={this.state.isShareDialogOpen} onClose={this.onCloseShareDialog} />
          <SaveDialog open={this.state.isSaveDialogOpen} onClose={this.onCloseSaveDialog} />
          <Toolbar>
            <ToolbarGroup>
              <ToolbarTitle text={Config.APP_TITLE} style={styles.title} />
              <div style={spacerStyle} />
              <BoardStatusIcon
                boardId={this.state.boardId}
                pubSubClient={fayeClient}
                showErrorsOnly={this.state.role === Role.User}
              />
            </ToolbarGroup>
            {renderAdminControls()}
          </Toolbar>
          <div className="App-editor">
            <MonacoEditor
              options={options}
              language={this.state.selectedLanguage}
              editorDidMount={this.editorDidMount}
              onChange={this.onEditorChange}
              requireConfig={requireConfig}
            />
          </div>
        </div>
      </MuiThemeProvider>
    );
  }
}
