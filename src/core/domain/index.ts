export {
    Host,
    dumpHosts,
    parseHostsYaml,
    HostDumpFormat
} from "./host";

export {
    UserCredential,
    dumpUserCredentials,
    parseUserCredentialsYaml,
    UserDumpFormat
} from "./user";

import { UserCredential } from "./user";
import { Host } from "./host";

export type Config = Host | UserCredential;
export type ConfigType = "host" | "user";
export { Collects, envVarSafer, mergeCollects } from "../env/collects";
