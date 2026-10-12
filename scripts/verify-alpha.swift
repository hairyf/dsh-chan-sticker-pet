import AVFoundation
import CoreVideo
import Foundation

func verify() throws {
    guard CommandLine.arguments.count == 5,
          let expectedFrames = Int(CommandLine.arguments[2]),
          let expectedDuration = Double(CommandLine.arguments[3]),
          let sourceMean = Double(CommandLine.arguments[4]) else {
        throw NSError(domain: "usage: verify-alpha <mov> <frames> <duration> <first-frame-alpha-mean>", code: 1)
    }
    let asset = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[1]))
    guard let track = asset.tracks(withMediaType: .video).first else {
        throw NSError(domain: "missing video track", code: 1)
    }
    let reader = try AVAssetReader(asset: asset)
    let output = AVAssetReaderTrackOutput(track: track, outputSettings: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
    ])
    reader.add(output)
    guard reader.startReading() else {
        throw reader.error ?? NSError(domain: "native decode did not start", code: 1)
    }
    var frames = 0
    var minimum: UInt8 = 255
    var maximum: UInt8 = 0
    var firstSum: Int = 0
    while let sample = output.copyNextSampleBuffer() {
        guard let buffer = CMSampleBufferGetImageBuffer(sample),
              CVPixelBufferGetWidth(buffer) == 500,
              CVPixelBufferGetHeight(buffer) == 500 else {
            throw NSError(domain: "decoded dimensions must match 500x500 source", code: 1)
        }
        CVPixelBufferLockBaseAddress(buffer, .readOnly)
        guard let base = CVPixelBufferGetBaseAddress(buffer) else {
            CVPixelBufferUnlockBaseAddress(buffer, .readOnly)
            throw NSError(domain: "missing decoded pixels", code: 1)
        }
        let bytes = base.assumingMemoryBound(to: UInt8.self)
        let stride = CVPixelBufferGetBytesPerRow(buffer)
        for y in 0..<500 {
            for x in 0..<500 {
                let alpha = bytes[y * stride + x * 4 + 3]
                minimum = min(minimum, alpha)
                maximum = max(maximum, alpha)
                if frames == 0 { firstSum += Int(alpha) }
            }
        }
        CVPixelBufferUnlockBaseAddress(buffer, .readOnly)
        frames += 1
    }
    guard reader.status == .completed else {
        throw reader.error ?? NSError(domain: "incomplete native decode", code: 1)
    }
    guard frames == expectedFrames,
          abs(asset.duration.seconds - expectedDuration) <= 1.0 / 30.0 + 0.005,
          minimum < 100, maximum > 200,
          abs(Double(firstSum) / 250000 - sourceMean) < 5 else {
        throw NSError(domain: "source mismatch or lost alpha: frames=\(frames)/\(expectedFrames), duration=\(asset.duration.seconds)/\(expectedDuration), alpha=\(minimum)...\(maximum), mean=\(Double(firstSum) / 250000)/\(sourceMean)", code: 1)
    }
    print("verified native HEVC-alpha: \(CommandLine.arguments[1]), frames=\(frames), alpha=\(minimum)...\(maximum)")
}

do {
    try verify()
} catch {
    FileHandle.standardError.write(Data("\(error)\n".utf8))
    exit(1)
}
