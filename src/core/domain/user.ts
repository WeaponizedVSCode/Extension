import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { table } from "table";
import { Collects, envVarSafer } from "../env/collects";

const default_bad_nt_hash = "ffffffffffffffffffffffffffffffff";

interface innerUserCredential {
  user?: string;
  password?: string;
  nt_hash?: string;
  login?: string;
  is_current?: boolean;
  props?: Collects;
}

export function parseUserCredentialsYaml(content: string): UserCredential[] {
  let userContent = yamlParse(content) as innerUserCredential[];
  let ret: UserCredential[] = [];
  for (let user of userContent) {
    let newUser = new UserCredential().init(user);
    ret.push(newUser);
  }
  return ret;
}

export type UserDumpFormat = "env" | "impacket" | "nxc" | "yaml" | "table";

export class UserCredential {
  user: string = "";
  password: string = "";
  nt_hash: string = default_bad_nt_hash;
  login: string = "";
  is_current: boolean = false;
  props: Collects = {};

  init(iuser: innerUserCredential): UserCredential {
    this.user = iuser.user ? iuser.user : "";
    if (iuser.password) {
      this.password = iuser.password;
    }
    if (iuser.nt_hash) {
      this.nt_hash = iuser.nt_hash;
    }
    this.login = iuser.login ? iuser.login : "";
    this.props = iuser.props ? iuser.props : {};
    this.is_current = iuser.is_current ? iuser.is_current : false;
    return this;
  }

  exportEnvironmentCollects(): Collects {
    let safename = envVarSafer(this.user);
    let collects = {} as Collects;

    collects[`USER_${safename}`] = this.user;
    if (this.login && (this.login !== "" || this.login !== this.user)) {
      collects[`LOGIN_${safename}`] = this.login;
    }

    if (this.is_current) {
      collects["CURRENT_USER"] = this.user;
      collects["USER"] = this.user;
      collects["USERNAME"] = this.user;
      collects["LOGIN"] = this.login;
    }

    if (this.nt_hash === default_bad_nt_hash || this.nt_hash === undefined) {
      collects[`PASS_${safename}`] = this.password;
      if (this.is_current) {
        collects["PASS"] = this.password;
        collects["PASSWORD"] = this.password;
      }
    } else {
      collects[`NT_HASH_${safename}`] = this.nt_hash;
      if (this.is_current) {
        collects["NT_HASH"] = this.nt_hash;
      }
    }

    if (this.props) {
      for (let key in this.props) {
        if (key.startsWith("ENV_")) {
          let realkey = key.replace("ENV_", "");
          collects[`${envVarSafer(realkey)}`] = this.props[key];
        }
        // collects[`${envVarSafer(key)}`] = this.props[key];
      }
    }
    return collects;
  }

  dumpUser(format?: UserDumpFormat): string {
    let ret = "";
    switch (format) {
      default:
      case "env":
        let collects = this.exportEnvironmentCollects();
        ret = "export ";
        for (let key in collects) {
          ret += `${key}='${collects[key]}' `;
        }
        ret = ret.trim();
        break;
      case "impacket":
        if (this.login && this.login !== "" && this.login !== this.user) {
          // if login is empty or same as username
          ret = `'${this.login}'/`;
        }
        if (this.nt_hash === default_bad_nt_hash) {
          ret = `${ret}'${this.user}':'${this.password}'`;
        } else {
          ret = `${ret}'${this.user}' -hashes ':${this.nt_hash}'`;
        }
        break;
      case "nxc":
        if (this.login && this.login !== "" && this.login !== this.user) {
          ret = `'${this.login}' -u '${this.user}'`;
        } else {
          ret = `-u '${this.user}'`;
        }
        if (this.nt_hash === default_bad_nt_hash) {
          ret = `${ret} -p '${this.password}'`;
        } else {
          ret = `${ret} -H ':${this.nt_hash}'`;
        }
        break;
      case "yaml":
        ret = yamlStringify(this);
    }
    return ret;
  }

  setAsCurrent(): UserCredential {
    this.is_current = true;
    return this;
  }
}

export function dumpUserCredentials(
  users: UserCredential[],
  format: UserDumpFormat
): string {
  let ret = "";
  if (format === "yaml") {
    ret = yamlStringify(users);
    return ret;
  }
  if (format === "table") {
    let header = [
      "Login",
      "Username",
      "Password",
      "NT Hash",
      "Is Current",
      "Properties",
    ];
    let data: string[][] = [header];
    for (let user of users) {
      let props_str = "";
      for (let key in user.props) {
        props_str += `${key}=${user.props[key]}\n`;
      }
      data.push([
        user.login,
        user.user,
        user.password,
        user.nt_hash,
        user.is_current ? "Yes" : "No",
        props_str,
      ]);
    }
    let t: string = table(data, {
      header: {
        content: "User Credentials",
      },
      columns: {
        0: { alignment: "left" },
        1: { alignment: "left" },
        2: { alignment: "left" },
        3: { alignment: "left" },
        4: { alignment: "center" },
        5: { alignment: "left" },
      },
    });
    return t;
  }
  for (let u of users) {
    let user = new UserCredential().init(u);
    ret += `${user.dumpUser(format)}\n`;
  }
  return ret;
}

function test() {
  let usera = new UserCredential();
  usera.init({
    login: "github.com",
  });
  usera.setAsCurrent();
  console.log(usera.dumpUser());
  let content = `
- login: github.com
  username: usera
  password: password
- login: data.github.com
  username: userax
  nt_hash: 0123456789ABCDEF0123456789ABCDEF
  is_current: true
`;
  let users = parseUserCredentialsYaml(content);
  console.log(dumpUserCredentials(users, "nxc"));
}

// (()=> { test() })();
