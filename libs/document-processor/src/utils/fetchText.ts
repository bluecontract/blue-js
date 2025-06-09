// import { request } from 'https';

const request = (url: string, callback: (res: any) => void) => {
  return {
    on: (event: string, callback: (chunk: any) => void) => {
      return { end: () => callback(null) };
    },
  };
};

export async function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    request(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`GET ${url} → ${res.statusCode}`));
        return;
      }
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: any) => (buf += chunk));
      res.on('end', () => resolve(buf));
    })
      .on('error', reject)
      .end();
  });
}
