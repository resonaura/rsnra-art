import styled from 'styled-components';

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  gap: 12px;
  text-align: center;
  color: ${({ theme }) => theme.materialTextDisabled};
`;

export function RecycleBin() {
  return (
    <Layout>
      <img
        src="/icons/recycle-bin-empty.png"
        alt=""
        width={48}
        height={48}
        style={{ imageRendering: 'pixelated' }}
      />
      <p style={{ margin: 0 }}>The Recycle Bin is empty.</p>
      <p style={{ margin: 0, fontSize: 11 }}>
        We keep our tracks, not our trash.
      </p>
    </Layout>
  );
}
