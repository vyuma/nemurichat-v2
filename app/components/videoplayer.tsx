import React from "react";
import Timer from "./timer";
import BackIcon from "./icon/back";
import NavigationButton from "./navigation_buttun";

const VideoPlayer = () => {
    return(
        <div className="relative w-full h-screen">
            
            <video 
                loop 
                autoPlay 
                muted 
                playsInline
                controls={false}
                className="absolute w-full h-full object-cover"
            >
                <source src="/videos/study1_1.mp4" type="video/mp4" />
                Your browser does not support the video tag.
            </video>
            
            <div className="relative">
       {/* アイコンをビデオの上に重ねる */}
        <NavigationButton
                href="home"
                label=""
                variant="back"
                icon={<BackIcon />}
                className="absolute top-4 left-4 z-20"
            />
        </div>



            <div className="absolute inset-0 flex items-center justify-center">
                <Timer />
            </div>
        </div>
    )
}

export default VideoPlayer;