import * as React from 'react';
import './App.css';
import MonacoEditor from 'react-monaco-editor';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import { MuiTheme } from 'material-ui/styles';
import { TouchTapEvent } from 'material-ui';
import getMuiTheme from 'material-ui/styles/getMuiTheme';
import { blue600 } from 'material-ui/styles/colors';
import FlatButton from 'material-ui/FlatButton';
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
  private clipBoard: Clipboard;
  private hashUpdateTimer: number;
  private history: History;

  static encodeUrlPath(boardId: string, boardConfig: BoardConfig) {
    return '/board/' + boardId + '/' + Utils.utoa(JSON.stringify(boardConfig));
  }

  constructor(props: AppProps) {
    super(props);

    this.onResize = this.onResize.bind(this);
    this.onSelectLanguage = this.onSelectLanguage.bind(this);
    this.editorDidMount = this.editorDidMount.bind(this);
    this.refreshBoardConfigInUrl = this.refreshBoardConfigInUrl.bind(this);
    this.onCopyToClipboard = this.onCopyToClipboard.bind(this);
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
        primary1Color: blue600,
      },
      toolbar: {
        height: 65,
        backgroundColor: '#26556D',
      }
    });
  }

  componentDidMount() {
    window.addEventListener('resize', this.onResize);
    this.clipBoard = new Clipboard('.shareBoardButton', { text: this.onCopyToClipboard });
    this.history = createBrowserHistory();
  }

  componentWillUnmount() {
    this.clipBoard.destroy();
    window.removeEventListener('resize', this.onResize);
  }

  onResize() {
    if (this.editor) {
      this.editor.layout();
    }
  }

  onSelectLanguage(event: TouchTapEvent, index: number, value: string) {;
    fayeClient.publish(`/${this.state.boardId}/language`, value);
  }

  handleLanguageUpdate(language : string) {
    this.setState({ selectedLanguage: language });
  }

  editorDidMount(editor: monaco.editor.ICodeEditor) {
    console.log('editorDidMount');

    this.editor = editor;
    this.editor.focus();

    console.log('location ' + JSON.stringify(this.history.location));

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
      boardId = Utils.uuidv4();
    }

    this.syncEngine = new SyncEngine(editor, fayeClient, boardId, boardContent);

    fayeClient.subscribe(`/${boardId}/language`, this.handleLanguageUpdate);

    const languages = monaco.languages
      .getLanguages()
      .map(function (lang: monaco.languages.ILanguageExtensionPoint) { return lang.id; });

    const path = App.encodeUrlPath(
      boardId,
      {
        role: role,
        language: language,
        content: boardContent
      }
    );
    this.history.replace(path);

    this.setState({
      selectedLanguage: language,
      languages: languages,
      boardId: boardId,
      role: role
    });
  }

  refreshBoardConfigInUrl() {
    const path = App.encodeUrlPath(
      this.state.boardId,
      {
        role: this.state.role,
        language: this.editor.getModel().getModeId(),
        content: this.editor.getValue()
      }
    );
    this.history.replace(path);
  }

  onCopyToClipboard(elem: Element): string {
    this.setState({ isShareDialogOpen: true });

    if (this.editor) {
      const path = App.encodeUrlPath(
        this.state.boardId,
        {
          role: Role.User,
          language: this.editor.getModel().getModeId(),
          content: this.editor.getValue()
        }
      );
      return `${window.location.protocol}//${window.location.host}${path}`;
    } else {
      return '';
    }
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
    clearTimeout(this.hashUpdateTimer);
    this.hashUpdateTimer = window.setTimeout(
      this.refreshBoardConfigInUrl,
      2000);
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
      // renderLineHighlight: 'none',
      // lineNumbers: 'on',
      fontFamily: 'Roboto Mono',
      // snippetSuggestions: 'none',

    };

    const styles = {
      title: {
        fontFamily: 'Permanent Marker',
        color: 'white',
        fontSize: 30
      },
      button: {
        color: 'white'
      }
    };

    const languageItems = this.state.languages.map((language: string) => (
      <MenuItem value={language} key={language} primaryText={language.toUpperCase()} />
    ));

    const renderAdminControls = () => {
      if (this.state.role === Role.Admin) {
        return (
          <ToolbarGroup>
            <FlatButton label="New" style={styles.button} containerElement={<a href="/" target="_blank" />} />
            <FlatButton className="shareBoardButton" label="Share" style={styles.button} />
            <DropDownMenu
              value={this.state.selectedLanguage}
              labelStyle={styles.button}
              onChange={this.onSelectLanguage}
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
              <BoardStatusIcon boardId={this.state.boardId} pubSubClient={fayeClient} />
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
