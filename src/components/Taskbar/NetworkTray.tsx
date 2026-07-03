import styled from "styled-components";

const Icon = styled.div`
  display: flex;
  align-items: center;
  padding: 0;

  img {
    width: 16px;
    height: 16px;
    image-rendering: pixelated;
  }
`;

// Static "connected" network icon — RSNRA.ART has no real networking, but
// the tray should always look plugged in, like a real Windows box.
export function NetworkTray() {
  return (
    <Icon title={"Local Area Connection\nConnected"}>
      <img src="/icons/w98_conn_pcs_on_on.png" alt="" draggable={false} />
    </Icon>
  );
}
