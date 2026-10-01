# 相信地產 30 秒動態設計影片

- `xiangxin_realestate_30s.mp4`：成品（1920×1080、30fps、含配樂）
- `music_synth.wav`：配樂，由 `src/audio.py` 以 numpy 純合成（120 BPM），無版權問題
- `shots/`：後台（`public/`）實際執行畫面截圖
- `src/`：製作原始碼。`template.html` 為逐格時間軸動畫；`render.js` 用 Playwright 逐格輸出；`audio.py` 合成配樂

後台畫面為專案實際介面（含真實 CSS 與標記），示範新聞資料為示意。
專案內沒有 Logo 檔，片中的房屋＋勾勾字標為暫代，請替換為正式 Logo。
畫面上的統計數字（每日節省 3 小時、準時發送率 99%、漏發 0 則）為示意，片中已標註。
