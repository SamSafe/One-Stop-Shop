import { downloadFile } from '../download';

export function download(raw: string, name = 'oss-garage-backup.json', type = 'application/json') {
  downloadFile(raw, name, type);
}
