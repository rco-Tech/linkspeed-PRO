using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

namespace LinkSpeedPro.Hardware {
    class Program {
        static Guid GUID_DEVINTERFACE_USB_HUB = new Guid("f18a0e88-c30c-11d0-8815-00a0c906bed8");
        static Guid GUID_DEVINTERFACE_USB_DEVICE = new Guid("A5DCBF10-6530-11D2-901F-00C04FB951ED");

        [DllImport("setupapi.dll", CharSet = CharSet.Auto, SetLastError = true)]
        static extern IntPtr SetupDiGetClassDevs(ref Guid ClassGuid, IntPtr Enumerator, IntPtr hwndParent, uint Flags);

        [DllImport("setupapi.dll", CharSet = CharSet.Auto, SetLastError = true)]
        static extern IntPtr SetupDiGetClassDevs(IntPtr ClassGuid, string Enumerator, IntPtr hwndParent, uint Flags);

        [DllImport("setupapi.dll", CharSet = CharSet.Auto, SetLastError = true)]
        static extern bool SetupDiEnumDeviceInterfaces(IntPtr DeviceInfoSet, IntPtr DeviceInfoData, ref Guid InterfaceClassGuid, uint MemberIndex, ref SP_DEVICE_INTERFACE_DATA DeviceInterfaceData);

        [DllImport("setupapi.dll", CharSet = CharSet.Auto, SetLastError = true)]
        static extern bool SetupDiGetDeviceInterfaceDetail(IntPtr DeviceInfoSet, ref SP_DEVICE_INTERFACE_DATA DeviceInterfaceData, IntPtr DeviceInterfaceDetailData, uint DeviceInterfaceDetailDataSize, ref uint RequiredSize, IntPtr DeviceInfoData);

        [DllImport("setupapi.dll", CharSet = CharSet.Auto, SetLastError = true)]
        static extern bool SetupDiEnumDeviceInfo(IntPtr DeviceInfoSet, uint MemberIndex, ref SP_DEVINFO_DATA DeviceInfoData);

        [DllImport("setupapi.dll", CharSet = CharSet.Auto, SetLastError = true)]
        static extern bool SetupDiGetDeviceRegistryProperty(IntPtr DeviceInfoSet, ref SP_DEVINFO_DATA DeviceInfoData, uint Property, out uint PropertyRegDataType, StringBuilder PropertyBuffer, uint PropertyBufferSize, out uint RequiredSize);

        [DllImport("setupapi.dll", SetLastError = true)]
        static extern bool SetupDiDestroyDeviceInfoList(IntPtr DeviceInfoSet);

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        static extern SafeFileHandle CreateFile(
            string lpFileName,
            uint dwDesiredAccess,
            uint dwShareMode,
            IntPtr lpSecurityAttributes,
            uint dwCreationDisposition,
            uint dwFlagsAndAttributes,
            IntPtr hTemplateFile
        );

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool DeviceIoControl(
            SafeFileHandle hDevice,
            uint dwIoControlCode,
            IntPtr lpInBuffer,
            uint nInBufferSize,
            IntPtr lpOutBuffer,
            uint nOutBufferSize,
            out uint lpBytesReturned,
            IntPtr lpOverlapped
        );

        [StructLayout(LayoutKind.Sequential)]
        struct SP_DEVICE_INTERFACE_DATA {
            public uint cbSize;
            public Guid InterfaceClassGuid;
            public uint Flags;
            public IntPtr Reserved;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct SP_DEVINFO_DATA {
            public uint cbSize;
            public Guid ClassGuid;
            public uint DevInst;
            public IntPtr Reserved;
        }

        const uint GENERIC_WRITE = 0x40000000;
        const uint FILE_SHARE_READ = 0x00000001;
        const uint FILE_SHARE_WRITE = 0x00000002;
        const uint OPEN_EXISTING = 3;

        const uint IOCTL_USB_GET_NODE_INFORMATION = 0x220408;
        const uint IOCTL_USB_GET_NODE_CONNECTION_INFORMATION_EX = 0x220448;
        const uint IOCTL_USB_GET_NODE_CONNECTION_INFORMATION_EX_V2 = 0x22045C;
        const uint IOCTL_USB_GET_DESCRIPTOR_FROM_NODE_CONNECTION = 0x220410;

        const uint SPDRP_DEVICEDESC = 0x00000000;
        const uint SPDRP_HARDWAREID = 0x00000001;
        const uint SPDRP_FRIENDLYNAME = 0x0000000C;
        const uint SPDRP_MFG = 0x0000000B;

        [StructLayout(LayoutKind.Sequential, Pack = 1)]
        struct USB_PROTOCOLS {
            public uint ul;
        }

        [StructLayout(LayoutKind.Sequential, Pack = 1)]
        struct USB_NODE_CONNECTION_INFORMATION_EX_V2_FLAGS {
            public uint ul;
        }

        [StructLayout(LayoutKind.Sequential, Pack = 1)]
        struct USB_NODE_CONNECTION_INFORMATION_EX_V2 {
            public int ConnectionIndex;
            public int Length;
            public USB_PROTOCOLS SupportedUsbProtocols;
            public USB_NODE_CONNECTION_INFORMATION_EX_V2_FLAGS Flags;
        }

        static string GetStringDescriptor(SafeFileHandle hHub, int port, byte stringIndex) {
            if (stringIndex == 0) return null;
            try {
                int bufSize = 512;
                IntPtr pBuf = Marshal.AllocHGlobal(bufSize);
                for (int i = 0; i < bufSize; i++) Marshal.WriteByte(pBuf, i, 0);

                Marshal.WriteInt32(pBuf, 0, port);
                Marshal.WriteByte(pBuf, 4, 0x80);
                Marshal.WriteByte(pBuf, 5, 0x06);
                Marshal.WriteInt16(pBuf, 6, (short)((3 << 8) | stringIndex));
                Marshal.WriteInt16(pBuf, 8, 0x0409); // English US
                Marshal.WriteInt16(pBuf, 10, 255);

                uint bytesReturned = 0;
                bool ok = DeviceIoControl(hHub, IOCTL_USB_GET_DESCRIPTOR_FROM_NODE_CONNECTION, pBuf, (uint)bufSize, pBuf, (uint)bufSize, out bytesReturned, IntPtr.Zero);
                string result = null;
                if (ok && bytesReturned > 14) {
                    byte bLength = Marshal.ReadByte(pBuf, 12);
                    byte bType = Marshal.ReadByte(pBuf, 13);
                    if (bType == 3 && bLength > 2) {
                        byte[] strBytes = new byte[bLength - 2];
                        Marshal.Copy((IntPtr)((long)pBuf + 14), strBytes, 0, strBytes.Length);
                        result = Encoding.Unicode.GetString(strBytes).TrimEnd('\0').Trim();
                    }
                }
                Marshal.FreeHGlobal(pBuf);
                return string.IsNullOrEmpty(result) ? null : result;
            } catch {
                return null;
            }
        }

        static Dictionary<string, string> GetDeviceDescriptions() {
            Dictionary<string, string> dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            IntPtr hDevInfo = SetupDiGetClassDevs(ref GUID_DEVINTERFACE_USB_DEVICE, IntPtr.Zero, IntPtr.Zero, 0x12);
            if (hDevInfo == (IntPtr)(-1)) return dict;

            SP_DEVINFO_DATA devData = new SP_DEVINFO_DATA();
            devData.cbSize = (uint)Marshal.SizeOf(typeof(SP_DEVINFO_DATA));

            uint i = 0;
            while (SetupDiEnumDeviceInfo(hDevInfo, i, ref devData)) {
                StringBuilder desc = new StringBuilder(512);
                StringBuilder hwid = new StringBuilder(512);
                StringBuilder friendly = new StringBuilder(512);
                uint type = 0, req = 0;

                SetupDiGetDeviceRegistryProperty(hDevInfo, ref devData, SPDRP_FRIENDLYNAME, out type, friendly, (uint)friendly.Capacity, out req);
                SetupDiGetDeviceRegistryProperty(hDevInfo, ref devData, SPDRP_DEVICEDESC, out type, desc, (uint)desc.Capacity, out req);
                SetupDiGetDeviceRegistryProperty(hDevInfo, ref devData, SPDRP_HARDWAREID, out type, hwid, (uint)hwid.Capacity, out req);

                string name = friendly.Length > 0 ? friendly.ToString() : desc.ToString();
                string id = hwid.ToString().ToUpper();
                if (!string.IsNullOrEmpty(name) && !string.IsNullOrEmpty(id)) {
                    int vidPos = id.IndexOf("VID_");
                    int pidPos = id.IndexOf("PID_");
                    if (vidPos >= 0 && pidPos >= 0) {
                        string key = id.Substring(vidPos, 8) + "_" + id.Substring(pidPos, 8);
                        if (!dict.ContainsKey(key)) dict[key] = name;
                    }
                }
                i++;
            }
            SetupDiDestroyDeviceInfoList(hDevInfo);
            return dict;
        }

        static string EscapeJson(string s) {
            if (s == null) return "null";
            StringBuilder sb = new StringBuilder("\"");
            foreach (char c in s) {
                if (c == '"') sb.Append("\\\"");
                else if (c == '\\') sb.Append("\\\\");
                else if (c == '\b') sb.Append("\\b");
                else if (c == '\f') sb.Append("\\f");
                else if (c == '\n') sb.Append("\\n");
                else if (c == '\r') sb.Append("\\r");
                else if (c == '\t') sb.Append("\\t");
                else if (c < 32) sb.AppendFormat("\\u{0:x4}", (int)c);
                else sb.Append(c);
            }
            sb.Append("\"");
            return sb.ToString();
        }

        static void ScanUsb4Routers(List<string> jsonItems) {
            try {
                IntPtr h = SetupDiGetClassDevs(IntPtr.Zero, "USB4", IntPtr.Zero, 0x02 | 0x04);
                if (h == (IntPtr)(-1)) return;

                SP_DEVINFO_DATA d = new SP_DEVINFO_DATA();
                d.cbSize = (uint)Marshal.SizeOf(typeof(SP_DEVINFO_DATA));

                uint i = 0;
                while (SetupDiEnumDeviceInfo(h, i, ref d)) {
                    StringBuilder friendly = new StringBuilder(256);
                    StringBuilder desc = new StringBuilder(256);
                    uint t = 0, req = 0;

                    SetupDiGetDeviceRegistryProperty(h, ref d, SPDRP_FRIENDLYNAME, out t, friendly, (uint)friendly.Capacity, out req);
                    SetupDiGetDeviceRegistryProperty(h, ref d, SPDRP_DEVICEDESC, out t, desc, (uint)desc.Capacity, out req);

                    string name = friendly.Length > 0 ? friendly.ToString() : desc.ToString();
                    if (string.IsNullOrEmpty(name)) name = "USB4 Host Router";

                    jsonItems.Add(string.Format(
                        "{{\"id\":\"usb4-router-{0}\",\"isThunderbolt\":true,\"product\":{1},\"manufacturer\":\"Microsoft / System Host Router\",\"vendorName\":\"USB4 / Thunderbolt 4 Controller\",\"idVendor\":\"8086\",\"idProduct\":\"0000\",\"version\":\"USB4 / Thunderbolt 4\",\"removable\":\"fixed\",\"rxLanes\":2,\"txLanes\":2,\"speedNumericMb\":40000,\"isRootHub\":true,\"isHub\":false,\"port\":0}}",
                        i,
                        EscapeJson(name)
                    ));
                    i++;
                }
                SetupDiDestroyDeviceInfoList(h);
            } catch {
                // Ignore if USB4 subsystem is not present
            }
        }

        public static void Main() {
            Dictionary<string, string> pnpNames = GetDeviceDescriptions();
            List<string> jsonItems = new List<string>();

            // Scan standard USB Hubs and child devices
            IntPtr hDevInfo = SetupDiGetClassDevs(ref GUID_DEVINTERFACE_USB_HUB, IntPtr.Zero, IntPtr.Zero, 0x12);
            if (hDevInfo != (IntPtr)(-1)) {
                SP_DEVICE_INTERFACE_DATA ifData = new SP_DEVICE_INTERFACE_DATA();
                ifData.cbSize = (uint)Marshal.SizeOf(typeof(SP_DEVICE_INTERFACE_DATA));

                uint hubIndex = 0;
                while (SetupDiEnumDeviceInterfaces(hDevInfo, IntPtr.Zero, ref GUID_DEVINTERFACE_USB_HUB, hubIndex, ref ifData)) {
                    uint reqSize = 0;
                    SetupDiGetDeviceInterfaceDetail(hDevInfo, ref ifData, IntPtr.Zero, 0, ref reqSize, IntPtr.Zero);
                    IntPtr detailBuf = Marshal.AllocHGlobal((int)reqSize);
                    Marshal.WriteInt32(detailBuf, IntPtr.Size == 8 ? 8 : 6);

                    if (SetupDiGetDeviceInterfaceDetail(hDevInfo, ref ifData, detailBuf, reqSize, ref reqSize, IntPtr.Zero)) {
                        string hubPath = Marshal.PtrToStringAuto((IntPtr)((long)detailBuf + 4));
                        string hubId = "hub-" + hubIndex;

                        // Report the Root Hub itself as a controller device in the topology tree
                        jsonItems.Add(string.Format(
                            "{{\"id\":\"{0}\",\"product\":\"USB Root Hub (USB 3.0)\",\"manufacturer\":\"Microsoft / System Host Controller\",\"vendorName\":\"Host Controller\",\"idVendor\":\"1d6b\",\"idProduct\":\"0003\",\"isRootHub\":true,\"isHub\":true,\"speedNumericMb\":10000,\"removable\":\"fixed\",\"port\":0}}",
                            hubId
                        ));

                        SafeFileHandle hHub = CreateFile(hubPath, GENERIC_WRITE, FILE_SHARE_WRITE | FILE_SHARE_READ, IntPtr.Zero, OPEN_EXISTING, 0, IntPtr.Zero);
                        if (!hHub.IsInvalid) {
                            int bufSize = 1024;
                            IntPtr pNode = Marshal.AllocHGlobal(bufSize);
                            uint bytesRet = 0;
                            if (DeviceIoControl(hHub, IOCTL_USB_GET_NODE_INFORMATION, pNode, (uint)bufSize, pNode, (uint)bufSize, out bytesRet, IntPtr.Zero)) {
                                byte nbrPorts = Marshal.ReadByte(pNode, 6);

                                for (int port = 1; port <= nbrPorts; port++) {
                                    int connSize = 1024;
                                    IntPtr pConn = Marshal.AllocHGlobal(connSize);
                                    Marshal.WriteInt32(pConn, 0, port);

                                    if (DeviceIoControl(hHub, IOCTL_USB_GET_NODE_CONNECTION_INFORMATION_EX, pConn, (uint)connSize, pConn, (uint)connSize, out bytesRet, IntPtr.Zero)) {
                                        byte speed = Marshal.ReadByte(pConn, 23);
                                        ushort idVendor = (ushort)Marshal.ReadInt16(pConn, 4 + 8);
                                        ushort idProduct = (ushort)Marshal.ReadInt16(pConn, 4 + 10);
                                        ushort bcdUSB = (ushort)Marshal.ReadInt16(pConn, 4 + 2);
                                        ushort bcdDevice = (ushort)Marshal.ReadInt16(pConn, 4 + 12);
                                        byte bDeviceClass = Marshal.ReadByte(pConn, 4 + 4);
                                        byte iMfg = Marshal.ReadByte(pConn, 4 + 14);
                                        byte iProd = Marshal.ReadByte(pConn, 4 + 15);
                                        byte iSerial = Marshal.ReadByte(pConn, 4 + 16);
                                        int connStatus = Marshal.ReadInt32(pConn, 30);

                                        if (idVendor != 0) {
                                            string vidHex = idVendor.ToString("x4");
                                            string pidHex = idProduct.ToString("x4");
                                            string key = "VID_" + vidHex.ToUpper() + "_PID_" + pidHex.ToUpper();

                                            string mfg = GetStringDescriptor(hHub, port, iMfg);
                                            string prod = GetStringDescriptor(hHub, port, iProd);
                                            string serial = GetStringDescriptor(hHub, port, iSerial);

                                            if (string.IsNullOrEmpty(prod) && pnpNames.ContainsKey(key)) {
                                                prod = pnpNames[key];
                                            }
                                            if (string.IsNullOrEmpty(prod)) prod = "USB Device (" + vidHex + ":" + pidHex + ")";

                                            // Determine base speed
                                            double speedMb = 480;
                                            if (speed == 0) speedMb = 1.5;
                                            else if (speed == 1) speedMb = 12;
                                            else if (speed == 2) speedMb = 480;
                                            else if (speed == 3) speedMb = 5000;

                                            // Query V2 for SuperSpeed+ and Capabilities
                                            bool isOperatingSuperSpeed = speed == 3;
                                            bool isSuperSpeedCapable = false;
                                            bool isOperatingSuperSpeedPlus = false;
                                            bool isSuperSpeedPlusCapable = false;

                                            USB_NODE_CONNECTION_INFORMATION_EX_V2 v2 = new USB_NODE_CONNECTION_INFORMATION_EX_V2();
                                            v2.ConnectionIndex = port;
                                            v2.Length = Marshal.SizeOf(typeof(USB_NODE_CONNECTION_INFORMATION_EX_V2));
                                            v2.SupportedUsbProtocols.ul = 7;
                                            int v2Size = Marshal.SizeOf(typeof(USB_NODE_CONNECTION_INFORMATION_EX_V2));
                                            IntPtr pV2 = Marshal.AllocHGlobal(v2Size);
                                            Marshal.StructureToPtr(v2, pV2, false);

                                            if (DeviceIoControl(hHub, IOCTL_USB_GET_NODE_CONNECTION_INFORMATION_EX_V2, pV2, (uint)v2Size, pV2, (uint)v2Size, out bytesRet, IntPtr.Zero)) {
                                                USB_NODE_CONNECTION_INFORMATION_EX_V2 resV2 = (USB_NODE_CONNECTION_INFORMATION_EX_V2)Marshal.PtrToStructure(pV2, typeof(USB_NODE_CONNECTION_INFORMATION_EX_V2));
                                                isOperatingSuperSpeed = (resV2.Flags.ul & 1) != 0;
                                                isSuperSpeedCapable = (resV2.Flags.ul & 2) != 0;
                                                isOperatingSuperSpeedPlus = (resV2.Flags.ul & 4) != 0;
                                                isSuperSpeedPlusCapable = (resV2.Flags.ul & 8) != 0;

                                                if (isOperatingSuperSpeedPlus) {
                                                    speedMb = 10000; // 10 Gbps SuperSpeed+
                                                } else if (isOperatingSuperSpeed && speedMb < 5000) {
                                                    speedMb = 5000;
                                                }
                                            }
                                            Marshal.FreeHGlobal(pV2);

                                            string verStr = string.Format("{0:X}.{1:X2}", (bcdUSB >> 8) & 0xFF, bcdUSB & 0xFF);
                                            string bcdDevStr = string.Format("{0:X4}", bcdDevice);
                                            string devClassStr = string.Format("{0:x2}", bDeviceClass);
                                            bool isHubDev = bDeviceClass == 0x09 || (prod != null && prod.ToLower().Contains("hub"));

                                            string devId = string.Format("win-{0}-{1}-{2}", hubIndex, port, serial ?? (vidHex + ":" + pidHex));

                                            jsonItems.Add(string.Format(
                                                "{{\"id\":\"{0}\",\"hubIndex\":{1},\"port\":{2},\"product\":{3},\"manufacturer\":{4},\"serial\":{5},\"idVendor\":\"{6}\",\"idProduct\":\"{7}\",\"version\":\"{8}\",\"bcdDevice\":\"{9}\",\"deviceClass\":\"{10}\",\"isHub\":{11},\"isRootHub\":false,\"speedNumericMb\":{12},\"isSuperSpeedCapable\":{13},\"isSuperSpeedPlusCapable\":{14},\"isOperatingSuperSpeedPlus\":{15},\"removable\":\"removable\"}}",
                                                devId,
                                                hubIndex,
                                                port,
                                                EscapeJson(prod),
                                                EscapeJson(mfg ?? ""),
                                                EscapeJson(serial),
                                                vidHex,
                                                pidHex,
                                                verStr,
                                                bcdDevStr,
                                                devClassStr,
                                                isHubDev ? "true" : "false",
                                                speedMb,
                                                isSuperSpeedCapable ? "true" : "false",
                                                isSuperSpeedPlusCapable ? "true" : "false",
                                                isOperatingSuperSpeedPlus ? "true" : "false"
                                            ));
                                        }
                                    }
                                    Marshal.FreeHGlobal(pConn);
                                }
                            }
                            Marshal.FreeHGlobal(pNode);
                            hHub.Close();
                        }
                    }
                    Marshal.FreeHGlobal(detailBuf);
                    hubIndex++;
                }
                SetupDiDestroyDeviceInfoList(hDevInfo);
            }

            // Scan USB4 / Thunderbolt 4 routers
            ScanUsb4Routers(jsonItems);

            Console.Write("[" + string.Join(",", jsonItems.ToArray()) + "]");
        }
    }
}
