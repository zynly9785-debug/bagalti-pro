import { registerPlugin } from '@capacitor/core';

export type PairedBluetoothDevice = { name: string; address: string };

type BluetoothPrinterPlugin = {
  openBluetoothSettings(): Promise<void>;
  listPairedDevices(): Promise<{ devices: PairedBluetoothDevice[] }>;
  connect(options: { address: string }): Promise<PairedBluetoothDevice>;
  print(options: { text: string }): Promise<void>;
  disconnect(): Promise<void>;
};

const bluetoothPrinter = registerPlugin<BluetoothPrinterPlugin>('BluetoothPrinter');

export const openBluetoothSettings = () => bluetoothPrinter.openBluetoothSettings();
export const listPairedBluetoothPrinters = async () => (await bluetoothPrinter.listPairedDevices()).devices;
export const connectBluetoothPrinter = (address: string) => bluetoothPrinter.connect({ address });
export const printBluetoothReceipt = (text: string) => bluetoothPrinter.print({ text });
export const disconnectBluetoothPrinter = () => bluetoothPrinter.disconnect();

export async function printReceiptOverBluetooth(address: string, text: string): Promise<void> {
  await connectBluetoothPrinter(address);
  try {
    await printBluetoothReceipt(text);
  } finally {
    await disconnectBluetoothPrinter();
  }
}
