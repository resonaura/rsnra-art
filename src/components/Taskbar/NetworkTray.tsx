import styled from "styled-components";
import { Icon } from "../Icon/Icon";

const Wrap = styled.div`
  display: flex;
  align-items: center;
  padding: 0;
`;

// Static "connected" network icon — RSNRA.ART has no real networking, but
// the tray should always look plugged in, like a real Windows box.
export function NetworkTray() {
  return (
    <Wrap title={"Internet Connection\nConnected"}>
      <Icon src="/icons/netshell.dll/000.ico" size={16} />
    </Wrap>
  );
}
