import Image from "next/image";

export function Home_Header() {
  return (
   
      
        <div className="flex ml-15 pt-10 pb-5 px-6 items-center">
         
          <Image
            src="/images/Alice_icon.png"
            alt="Alice icon"
            width={80}
            height={80}
          />
          
          <div className="pl-10" style={{ color: '#AB6666' }}>
            <h2 className="text-2xl font-bold border-white ">アリス</h2>
            <h2 className="text-md font-normal">Level</h2>
          </div>
        </div>
      
  );
}